
//import { decodeAuthHeader, AuthTokenPayload } from "./utils/auth";
import { Request } from "express";
import { PrismaClient } from "@prisma/client";


export interface Context {
    db: PrismaClient;
    userId?: number;
}

export const context = ({ req }: { req: Request }): Context => {
    return {
        db: new PrismaClient() 
    };
};