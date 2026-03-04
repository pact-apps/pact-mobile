import { createPactApi } from "./pactApi";
import { API_BASE_URL } from "../utils/constants";

/** Singleton API client instance */
export const pactApi = createPactApi(API_BASE_URL);
