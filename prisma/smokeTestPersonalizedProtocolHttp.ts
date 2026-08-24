import "dotenv/config";
import { spawn, ChildProcess } from "child_process";
import jwt from "jsonwebtoken";

const PORT = 5099;
const BASE = `http://localhost:${PORT}/api/chemotherapy`;
const SECRET = process.env.JWT_SECRET!;

let server: ChildProcess;

function mintToken(role: string, hospitalId: string, userId: string): string {
    return jwt.sign(
        { id: userId, user_id: userId, employee_id: null, username: `smoke_${role.toLowerCase()}`, role, hospital_id: hospitalId },
        SECRET,
        { expiresIn: "1h" }
    );
}

let passed = 0;
let failed = 0;

async function call(method: string, path: string, token: string, body?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
}

function check(label: string, condition: boolean, detail?: unknown) {
    if (condition) {
        passed++;
        console.log(`  PASS: ${label}`);
    } else {
        failed++;
        console.error(`  FAIL: ${label}`, detail ?? "");
    }
}

async function waitForHealth(timeoutMs = 30000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`http://localhost:${PORT}/api/health`);
            if (res.ok) return true;
        } catch { /* not up yet */ }
        await new Promise((r) => setTimeout(r, 500));
    }
    return false;
}

async function main() {

    console.log("\n=== HTTP SMOKE TEST: personalized protocol routes/middleware/validation ===\n");

    server = spawn("npx", ["ts-node", "src/server.ts"], {
        env: { ...process.env, PORT: String(PORT) },
        stdio: "ignore",
        shell: true
    });

    if (!(await waitForHealth())) {
        console.error("server did not start in time");
        process.exitCode = 1;
        return;
    }
    console.log("  server up on port " + PORT);

    const adminA = mintToken("HEAD_ADMIN", "HSP001", "USR117");
    const adminB = mintToken("HEAD_ADMIN", "HSP002", "USR127");
    const doctor = mintToken("DOCTOR", "HSP001", "USR117");

    // 1. Auth + permission wiring
    let r = await call("GET", "/regimen-protocols/personalized", "");
    check("no token -> 401", r.status === 401, r);

    r = await call("GET", "/regimen-protocols/personalized", adminA);
    check("HEAD_ADMIN (chemo.protocol.read) can list personalized -> 200", r.status === 200 && r.json?.success === true, r);

    r = await call("GET", "/regimen-protocols/personalized", doctor);
    check("DOCTOR (read-only) can list personalized -> 200", r.status === 200, r);

    r = await call("POST", "/regimen-protocols/RGP015/personalize", doctor, {});
    check("DOCTOR cannot manage protocols -> 403", r.status === 403, r);

    // 2. Route ordering: /regimen-protocols/personalized is NOT swallowed by :protocolId
    r = await call("GET", "/regimen-protocols/personalized", adminA);
    check("list route not captured by :protocolId param", r.status === 200 && Array.isArray(r.json?.data), r);

    // 3. Validation array works (bad body)
    r = await call("POST", "/regimen-protocols/RGP015/personalize", adminA, {
        days: [{ day_number: "not-a-number" }],
        items: [{ medicine_id: "MED000028", drug_sequence: 0 }]
    });
    check("invalid personalize body -> 400 with validation message", r.status === 400 && r.json?.message, r);

    // 4. Full happy-path via HTTP: personalize -> get -> activate
    r = await call("POST", "/regimen-protocols/RGP015/personalize", adminA, {
        regimen_name: "Smoke Test Org A Personalized"
    });
    check("personalize via HTTP -> 201", r.status === 201 && r.json?.data?.protocol?.protocol_type === "PERSONALIZED", { status: r.status, body: r.json });

    const pid = r.json?.data?.protocol?.protocol_id;
    check("created clone has protocol_id", typeof pid === "string", pid);

    if (pid) {
        r = await call("GET", `/regimen-protocols/personalized/${pid}`, adminB);
        check("org B cannot fetch org A clone via HTTP -> 400/404", r.status === 400 && r.json?.success === false, r);

        r = await call("GET", `/regimen-protocols/personalized/${pid}`, adminA);
        check("org A can fetch clone via HTTP -> 200", r.status === 200 && r.json?.data?.status === "DRAFT", r);

        r = await call("POST", `/regimen-protocols/personalized/${pid}/activate`, adminA);
        check("activate via HTTP -> 200", r.status === 200 && r.json?.data?.status === "ACTIVE", r);

        r = await call("PUT", `/regimen-protocols/personalized/${pid}`, adminA, { regimen_name: "Smoke Renamed" });
        check("update header via HTTP -> 200", r.status === 200 && r.json?.data?.protocol?.regimen_name === "Smoke Renamed", r);

        r = await call("POST", `/regimen-protocols/personalized/${pid}/items`, adminA, {
            medicine_id: "MED000032", drug_role: "PRIMARY", drug_sequence: 50, administration_day: 1
        });
        check("add item via HTTP -> 201", r.status === 201, r);

        r = await call("POST", `/regimen-protocols/personalized/${pid}/days`, adminA, { day_number: 9 });
        check("add day via HTTP -> 201", r.status === 201 && r.json?.data?.days?.some((d: any) => d.day_number === 9), r);

        r = await call("POST", `/regimen-protocols/personalized/${pid}/version`, adminA, { reason: "smoke version" });
        check("version via HTTP -> 201 with v2", r.status === 201 && r.json?.data?.protocol?.protocol_version === "v2", r);
    }

    // 5. Generic list still excludes personalized
    r = await call("GET", "/regimen-protocols", adminA);
    check("generic list 200", r.status === 200, r);
    if (pid) {
        check("clone not in generic list", !(r.json?.data ?? []).some((p: any) => p.protocol_id === pid));
    }

    console.log(`\n=== HTTP SMOKE RESULT: ${passed} passed, ${failed} failed ===\n`);

    process.exitCode = failed > 0 ? 1 : 0;

}

main()
    .catch((e) => { console.error("HTTP smoke crashed:", e); process.exitCode = 1; })
    .finally(() => {
        if (server) {
            server.kill();
        }
    });