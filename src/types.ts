import { Request } from 'express';

export interface EchoResponse {
  args: Record<string, string>;
  data: string;
  files: Record<string, string>;
  form: Record<string, string>;
  headers: Record<string, string>;
  json: Record<string, unknown> | null;
  origin: string;
  url: string;
}

export interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}
