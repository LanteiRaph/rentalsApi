import { Kind } from "graphql";
import {  scalarType } from "nexus";

export const AmountScalar = scalarType({
    name: 'Amount',
    asNexusMethod: 'amount',
    parseValue: (value) => value,
    serialize: ((value) => Math.round((value as number))),
    parseLiteral: (ast) => {
        return null
    }
})


export const DateScalar = scalarType({
    name: 'Date',
    asNexusMethod: 'date',
    parseValue: (value) => value,
    serialize: (value) => {
        return new Date((value as string));
    },
    parseLiteral: (ast) => {
        if (ast.kind === Kind.INT) {
            return new Date(ast.value);
        }
        return null;
    }
})