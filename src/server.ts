import { ApolloServer } from "apollo-server";

import {schema} from './schema';
import { context } from "./context";

export const server = new ApolloServer({
    schema,
    context:context
})


server.listen({port:8000}).then(({url}) => {
    console.log(`Server Ready at ${url}`)
})