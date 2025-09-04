declare module "mongoose-gridfs" {
  import mongoose from "mongoose";
  import { Readable } from "stream";

  export interface WriteOptions {
    filename: string;
    contentType?: string;
  }

  export interface FileInfo {
    _id: mongoose.Types.ObjectId;
    length: number;
    chunkSize: number;
    uploadDate: Date;
    filename: string;
    contentType: string;
  }

  export interface GridFSWriteStream {
    on(event: 'file', listener: (file: FileInfo) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'finish', listener: () => void): this;
    on(event: string, listener: Function): this;
  }

  export interface GridFSModel {
    write(options: WriteOptions, buffer: Buffer | Readable): GridFSWriteStream;
    read(options: { _id: mongoose.Types.ObjectId }): NodeJS.ReadableStream;
    findOne(query: any): Promise<FileInfo | null>;
    unlink(id: mongoose.Types.ObjectId): Promise<void>;
  }

  export function createModel(opts: {
    modelName: string;
    connection: mongoose.Connection;
  }): GridFSModel;
}
