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

import { Dictionary } from "@ejc-tsds/dictionary";
import { ArrayList } from "@ejc-tsds/arraylist";
import { Set } from "@ejc-tsds/set";
import * as WebSocket from "ws";
import * as HTTP from "http";
import { ObjectType, ObjectTypeDefinition, StandardType } from "typit";
import {ECGenerator} from "@elijahjcobb/encryption";

export interface IECWSError {
	readonly status: number;
	readonly message: string;
}

export class ECWSError implements IECWSError{

	private shouldShow: boolean = false;
	public status: number = 500;
	public message: string = "Internal server error.";

	public code(value: number): ECWSError {

		this.status = value;
		return this;

	}

	public msg(value: string): ECWSError {

		this.message = value;
		return this;

	}

	public passthrough(): ECWSError {

		this.shouldShow = true;
		return this;

	}

	public getJSON(): IECWSError {
		return {
			status: this.shouldShow ? this.status : 500,
			message: this.shouldShow ? this.message : "Internal server error."
		};
	}

	public print(): void {

		console.error(`Error (${this.status}):\n${this.message}`);

	}

	public static init(): ECWSError {

		return new ECWSError();

	}
}

export interface ECWSCommandable {
	register(cmd: string, types: ObjectTypeDefinition, handler: (req: ECWSRequest) => Promise<ECWSResponse>): void;
}

export interface ECWSIMessage<P = object> {
	cmd: string;
	meta: ECWSIMeta;
	payload: P;
}

export interface ECWSIMeta {
	timestamp: number;
	id: string;
}

export interface ECWSIError {
	msg: string;
	code: number;
}

export type PromiseResolve<T> = (value?: T | PromiseLike<T> | undefined) => void;
export type PromiseReject = (reason?: any) => void;

export interface ECWSIMessageResponse<P = object> {
	request: ECWSRequest;
	response: {
		meta: ECWSIMeta;
		payload?: P;
		error?: ECWSIError;
	};
}

export class ECWSRequest {

	public readonly payload: object;
	public readonly cmd: string;
	public readonly meta: ECWSIMeta;

	public constructor(message: ECWSIMessage, command: ECWSCommand) {

		this.cmd = command.cmd;
		this.payload = message.payload;
		this.meta = message.meta;

	}

}

export class ECWSResponse {

	public request: ECWSRequest | undefined;
	public meta: ECWSIMeta | undefined;
	public payload: object;

	public constructor(value: object) {
		this.payload = value;
	}

}

export class ECWSCommand {

	public readonly cmd: string;
	public readonly typeValidator: ObjectType;
	public readonly handler: (req: ECWSRequest, connection: ECWSConnection) => Promise<ECWSResponse>;

	public constructor(cmd: string, types: ObjectTypeDefinition, handler: (req: ECWSRequest, connection: ECWSConnection) => Promise<ECWSResponse>) {

		this.cmd = cmd;
		this.typeValidator = new ObjectType(types);
		this.handler = handler;

	}

}

export class ECWSConnection {

	protected commands: Dictionary<string, ECWSCommand>;
	protected openRequests: Dictionary<string, (res: ECWSIMessageResponse) => void>;

	public readonly socket: WebSocket;
	public readonly id: string;
	public readonly ip: string;
	public onOpenHandler: (() => void) | undefined;
	public onCloseHandler: (() => void) | undefined;
	public onMessageHandler: (() => void) | undefined;

	public constructor(ws: WebSocket, id: string, ip: string, commands: Dictionary<string, ECWSCommand>) {

		this.ip = ip;
		this.socket = ws;
		this.id = id;
		this.commands = commands;
		this.openRequests = new Dictionary<string, (res: ECWSIMessageResponse) => void>();

	}

	private generateNewRequestId(): string {

		let id: string = ECGenerator.randomId();
		while (this.openRequests.hasKey(id)) id = ECGenerator.randomId();

		return id;

	}

	private onOpen(): void {

		console.log("Socket opened.");
		if (this.onOpenHandler !== undefined) this.onOpenHandler();

	}

	private onClose(): void {

		console.log("Socket closed.");
		if (this.onCloseHandler !== undefined) this.onCloseHandler();

	}

	private onMessage(data: WebSocket.Data): void {

		if (!(data instanceof Buffer)) return;
		this.handleMessageReceived(data).then(() => {

			console.log("Socket received message.");
			if (this.onMessageHandler !== undefined) this.onMessageHandler();

		}).catch((err: any) => {

			this.sendResponse(new ECWSResponse({ err }));

		});


	}

	private async handleMessageReceived(data: Buffer): Promise<void> {

		const req: ECWSRequest | undefined = await this.parseRequest(data);
		if (!req) return;
		const cmd: ECWSCommand | undefined = this.commands.get(req.cmd);
		if (!cmd) throw ECWSError.init().msg("Command does not exist.").code(404).passthrough();

		const res: ECWSResponse = await cmd.handler(req, this);
		await this.sendResponse(res);

	}

	private async parseRequest(data: Buffer): Promise<ECWSRequest | undefined> {

		const messageDecoded: string = data.toString("utf8");

		let messageObject: ECWSIMessage | ECWSIMessageResponse;

		try {
			messageObject = JSON.parse(messageDecoded);
		} catch (e) {
			throw ECWSError.init().msg("The payload was not valid JSON.").code(400).passthrough();
		}

		if (messageObject.hasOwnProperty("request") && messageObject.hasOwnProperty("response")) {

			const body: ECWSIMessageResponse = messageObject as ECWSIMessageResponse;
			const id: string = body.request.meta.id;

			const handler: ((res: ECWSIMessageResponse) => void) | undefined = this.openRequests.get(id);
			if (handler) {

				handler(body);
				this.openRequests.remove(id);

				return;

			}

		} else {

			const body: ECWSIMessage = messageObject as ECWSIMessage;

			let objectTypeValidator: ObjectType = new ObjectType({
				cmd: StandardType.STRING,
				meta: new ObjectType(),
				payload: new ObjectType()
			});

			const isMessageValid: boolean = objectTypeValidator.checkConformity(messageObject);
			if (!isMessageValid) throw ECWSError.init().msg("Message doesn't have valid types.").code(400).passthrough();

			const command: ECWSCommand | undefined = this.commands.get(body.cmd);
			if (!command) throw ECWSError.init().msg("Command does not exist.").code(404).passthrough();

			const payload: object = body.payload;
			const isPayloadValid: boolean = command.typeValidator.checkConformity(payload);
			if (!isPayloadValid) throw ECWSError.init().msg("Message payload doesn't have valid types.").code(400).passthrough();

			return new ECWSRequest(body, command);

		}

	}

	private sendResponse(value: ECWSResponse): void {

		const request: ECWSRequest | undefined = value.request;
		if (!request) return;
		if (!value.meta) return;

		let obj: ECWSIMessageResponse = {
			request,
			response: {
				meta: value.meta,
				payload: value.payload,
			},
		};

		try {

			const data: Buffer = Buffer.from(JSON.stringify(obj), "utf8");
			this.socket.send(data);

		} catch (e) {

			return;

		}


	}

	public callAsync(cmd: string, payload: object, handler: (res: ECWSIMessageResponse) => void): void {

		const id: string = this.generateNewRequestId();
		const req: ECWSIMessage<object> = {
			cmd,
			meta: {
				id,
				timestamp: Date.now()
			},
			payload
		};

		let data: Buffer;

		try {

			data = Buffer.from(JSON.stringify(req), "utf8");

		} catch (e) {

			throw ECWSError.init().msg("Could not encode payload.").passthrough();

		}

		this.socket.send(data);
		this.openRequests.set(id, handler);

	}

	public call(cmd: string, payload: object): Promise<ECWSIMessageResponse> {

		return new Promise<ECWSIMessageResponse>(((resolve: PromiseResolve<ECWSIMessageResponse>): void => {

			this.callAsync(cmd, payload, resolve);

		}));

	}


}

export class ECWSSocket extends ECWSConnection implements ECWSCommandable {

	public constructor(url: string) {

		super(new WebSocket(url), "", "1.1.1.1", new Dictionary<string, ECWSCommand>());

	}

	public register(cmd: string, types: ObjectTypeDefinition, handler: (req: ECWSRequest) => Promise<ECWSResponse>): void {

		this.commands.set(cmd, new ECWSCommand(cmd, types, handler));

	}

}

export class ECWSServer implements ECWSCommandable {

	private server: WebSocket.Server | undefined;
	private connections: Dictionary<string, ECWSConnection>;
	private readonly options: WebSocket.ServerOptions | undefined;
	private authorizationHandler: ((req: HTTP.IncomingMessage) => Promise<void>) | undefined;
	private readonly commands: Dictionary<string, ECWSCommand>;
	protected openRequests: Dictionary<string, (res: ECWSIMessageResponse) => void>;

	public constructor(options?: WebSocket.ServerOptions) {

		this.connections = new Dictionary<string, ECWSConnection>();
		this.commands = new Dictionary<string, ECWSCommand>();
		this.options = options;
		this.openRequests = new Dictionary<string, (res: ECWSIMessageResponse) => void>();

	}

	private generateNewRequestId(): string {

		let id: string = ECGenerator.randomId();
		while (this.openRequests.hasKey(id)) id = ECGenerator.randomId();

		return id;

	}

	private generateNewConnectionId(): string {

		let id: string = ECGenerator.randomId();
		while (this.connections.hasKey(id)) id = ECGenerator.randomId();

		return id;

	}

	public register(cmd: string, types: ObjectTypeDefinition, handler: (req: ECWSRequest, connection: ECWSConnection) => Promise<ECWSResponse>): void {

		this.commands.set(cmd, new ECWSCommand(cmd, types, handler));

	}

	public start(): void {

		this.server = new WebSocket.Server(this.options);

		this.server.on("connection", (socket: WebSocket, request: HTTP.IncomingMessage) => {

			if (this.authorizationHandler !== undefined) { this.authorizationHandler(request).then(() => {}).catch((err: any) => {



			}); }

			socket.on

			const connection: ECWSConnection = new ECWSConnection(socket, this.generateNewConnectionId(), request.connection.remoteAddress || request.connection.localAddress, this.commands);
			this.connections.set(connection.id, connection);

		});

	}

	public callAsync(connectionId: string, cmd: string, payload: object, handler: (res: ECWSIMessageResponse) => void): void {

		const id: string = this.generateNewRequestId();
		const req: ECWSIMessage<object> = {
			cmd,
			meta: {
				id,
				timestamp: Date.now()
			},
			payload
		};

		let data: Buffer;

		try {

			data = Buffer.from(JSON.stringify(req), "utf8");

		} catch (e) {

			throw ECWSError.init().msg("Could not encode payload.").passthrough();

		}

		const connection: ECWSConnection | undefined = this.connections.get(connectionId);
		if (connection) connection.socket.send(data);
		this.openRequests.set(id, handler);

	}

}




const server: ECWSServer = new ECWSServer({ port: 8080 });

server.register("hi", {foo: StandardType.STRING}, async(req: ECWSRequest, connection: ECWSConnection): Promise<ECWSResponse> => {

	console.log(connection.ip);

	return new ECWSResponse({bar: req.payload});

});

server.start();



const socket: ECWSSocket = new ECWSSocket("ws://localhost:8080");
socket.register("hi", {}, async(req: ECWSRequest): Promise<ECWSResponse> => {

	return new ECWSResponse({});

});

socket.call("hi", {foo: "Hello, world!"}).then((res: ECWSIMessageResponse) => {

	console.log(res);

}).catch((err: any) => {});
