/**
 *
 * Elijah Cobb
 * elijah@elijahcobb.com
 * https://elijahcobb.com
 *
 *
 * Copyright 2019 Elijah Cobb
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
 * to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS
 * OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

import * as WebSocket from "ws";
import * as HTTP from "http";
import {ECArrayList, ECMap} from "@elijahjcobb/collections";
import {ECGenerator} from "@elijahjcobb/encryption";
import { ObjectType, StandardType, ObjectTypeDefinition } from "typit";

export class Error {



}

export interface IMessage<P = object> {
	cmd: string;
	meta: IMeta;
	payload: P;
}

export interface IMeta {
	timestamp: number;
	id: string;
}

export interface IError {
	msg: string;
	code: number;
}

export interface IMessageResponse<P = object> {
	request: Request;
	response: {
		meta: IMeta;
		payload?: P;
		error?: IError;
	};
}

export class Command {

	public readonly cmd: string;
	public readonly typeValidator: ObjectType;
	public readonly handler: (req: Request) => Promise<Response>;

	public constructor(cmd: string, types: ObjectTypeDefinition, handler: (req: Request) => Promise<Response>) {

		this.cmd = cmd;
		this.typeValidator = new ObjectType(types);
		this.handler = handler;

	}

}

export class Request {

	public readonly payload: object;
	public readonly cmd: string;
	public readonly meta: IMeta;

	public constructor(message: IMessage, command: Command) {

		this.cmd = command.cmd;
		this.payload = message.payload;
		this.meta = message.meta;

	}

}

export class Response {

	public request: Request | undefined;
	public meta: IMeta | undefined;
	public payload: object;

	public constructor(value: object) {
		this.payload = value;
	}

}

export class Socket {

	public readonly ws: WebSocket;
	public readonly id: string;
	public readonly request: HTTP.IncomingMessage;
	public openRequests: ECArrayList<string>;

	public constructor(id: string, ws: WebSocket, req: HTTP.IncomingMessage) {

		this.id = id;
		this.ws = ws;
		this.request = req;
		this.openRequests = new ECArrayList<string>();

	}

	public send(value: Response): void {

		const request: Request | undefined = value.request;
		if (!request) return Server.handleError(""); //TODO handle error
		if (!value.meta) return Server.handleError(""); //TODO handle error

		let obj: IMessageResponse = {
			request,
			response: {
				meta: value.meta,
				payload: value.payload,
			},
		};

		let data: Buffer;

		try {

			data = Buffer.from(JSON.stringify(obj), "utf8");

		} catch (e) {

			return Server.handleError(""); //TODO Handler error.

		}

		this.ws.send(data);

	}

}

export class Server {

	private server: WebSocket.Server | undefined;
	private sockets: ECMap<string, Socket>;
	private commands: ECMap<string, Command>;
	private readonly options: WebSocket.ServerOptions | undefined;
	private authorizationHandler: ((socket: Socket) => Promise<void>) | undefined;

	public constructor(options?: WebSocket.ServerOptions) {

		this.handleNewConnection = this.handleNewConnection.bind(this);

		this.commands = new ECMap<string, Command>();
		this.sockets = new ECMap<string, Socket>();
		this.options = options;

	}

	private handleNewConnection(ws: WebSocket, req: HTTP.IncomingMessage): void {

		const id: string = this.generateNewSocketId();
		const socket: Socket = new Socket(id, ws, req);

		ws.on("message", (message: WebSocket.Data) => {

			let messageString: string = "{}";
			if (message instanceof Buffer) {
				try {
					messageString = message.toString("utf8");
				} catch (e) {}
			} else if (typeof message === "string") messageString = message;

			let messageObject: IMessage;

			try {
				messageObject = JSON.parse(messageString);
			} catch (e) {
				//TODO throw error here.
				return Server.handleError("Failed to parse data.");
			}

			let objectTypeValidator: ObjectType = new ObjectType({
				cmd: StandardType.STRING,
				meta: new ObjectType(),
				payload: new ObjectType()
			});

			const isMessageValid: boolean = objectTypeValidator.checkConformity(messageObject);
			if (!isMessageValid) return Server.handleError("Message object not valid."); //TODO add this error...

			const command: Command | undefined = this.commands.get(messageObject.cmd);
			if (!command) return;

			const payload: object = messageObject.payload;
			const isPayloadValid: boolean = command.typeValidator.checkConformity(payload);
			if (!isPayloadValid) return Server.handleError("Payload not valid."); //TODO add this error.

			const request: Request = new Request(messageObject, command);
			const requestId: string = request.meta.id;

			if (socket.openRequests.contains(requestId)) return Server.handleError("Server has duplicate request id."); //TODO add this error.
			socket.openRequests.add(requestId);

			command.handler(request).then((response: Response) => {

				response.request = request;
				response.meta = {
					timestamp: Date.now(),
					id: requestId
				};
				socket.send(response);

				socket.openRequests.removeValue(requestId);

			}).catch((err: any) => {

				Server.handleError(err);

			});

			// MAKE SURE TO HAVE ERROR HANDLING HERE - have a ECSError like system for this.
			// MAKE SURE TO HAVE ID system for request and response ids to make sure they don't duplicate...

			// have system for sending message to socket by id with error if it doesnt exist
			// have system for sending message to socket by id where error will not happen
			// have system for sending messsage to socket object
		});

		ws.on("close", (code: number, reason: string) => {

			console.log(`Closed socket with exit code '${code}' and message '${reason}'.`);
			this.removeSocket(socket);

		});

		if (this.authorizationHandler) {

			this.authorizationHandler(socket).then(() => {

				this.sockets.set(id, socket);

			}).catch((err: any) => {

				return Server.handleError(""); //TODO handle this error.

			});

		}

	}

	private generateNewSocketId(): string {

		let id: string = ECGenerator.randomId();
		while (this.sockets.containsKey(id)) id = ECGenerator.randomId();

		return id;

	}

	public setAuthorizationHandler(handler: (socket: Socket) => Promise<void>): void {

		this.authorizationHandler = handler;

	}

	public removeSocket(socket: Socket): void {

		this.sockets.remove(socket.id);

	}

	public removeSocketById(id: string): void {

		this.sockets.remove(id);

	}

	public register(command: Command): void {

		this.commands.set(command.cmd, command);

	}

	public getSocket(id: string): Socket | undefined {

		return this.sockets.get(id);

	}

	public start(): void {

		this.server = new WebSocket.Server(this.options);
		this.server.on("connection", this.handleNewConnection);

	}

	public static handleError(err: any): void {

		console.error(`ERR FOUND IN HANDLE ERROR:`);
		console.error(err);

	}

}