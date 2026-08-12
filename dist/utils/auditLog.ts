export async function recordAuditLog(data: {
  username?: string;
  moduleName: string;
  actionType: string;
}) {
  console.log("AUDIT LOG:", data);
}