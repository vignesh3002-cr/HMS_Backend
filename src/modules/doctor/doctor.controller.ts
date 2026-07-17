<<<<<<< HEAD
import { Request, Response } from "express";
=======
{/*import { Request, Response } from "express";
>>>>>>> 8513f9342964d7350f5775a3b575ab03ee99de79
import * as DoctorService from "./doctor.service";

export const getDoctors = async (
    req: Request,
    res: Response
) => {

    try {

        const doctors =
            await DoctorService.getDoctors();

        res.json({

            success: true,

            message:
                "Doctors fetched successfully",

            data: doctors

        });

    } catch (error: any) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};
export const getDoctorByEmployeeId = async (

    req: Request,

    res: Response

) => {

    try {
        const employeeId = req.params.employeeId as string;

        const doctor =
            await DoctorService.getDoctorByEmployeeId(
                employeeId
            );

        res.json({

            success: true,

            message:
                "Doctor fetched successfully",

            data: doctor

        });

    } catch (error: any) {

        res.status(404).json({

            success: false,

            message: error.message

        });

    }

<<<<<<< HEAD
}
=======
}*/}
>>>>>>> 8513f9342964d7350f5775a3b575ab03ee99de79
