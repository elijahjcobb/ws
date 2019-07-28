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
import {ECMap} from "@elijahjcobb/collections";
import {ECGenerator} from "@elijahjcobb/encryption";
import {Debugger} from "inspector";
import SetScriptSourceParameterType = module

interface IMessage {
	cmd: string;
	meta: object;
	data: object;
}


class Command {

	public readonly cmd: string;
	public typeValidator: object;
	public handler: (req: Request) => Promise<Response>;

	public constructor(cmd: string, typeValidator: object, handler: (req: Request) => Promise<Response>) {

		this.cmd = cmd;
		this.typeValidator = typeValidator;
		this.handler = handler;

	}

}

class Request {

	public readonly timestamp: number;
	public readonly body: object;
	public readonly cmd: string;
	public readonly id: string;

	public constructor(cmd: string, timestamp: number, body: object) {

		this.cmd = cmd;
		this.timestamp = timestamp;
		this.body = body;
		this.id = ECGenerator.randomId();

	}

}

class Response {

	public constructor(request: Request, value: object) {

	}

}

class Socket {

	public readonly ws: WebSocket;
	public readonly id: string;
	public readonly request: HTTP.IncomingMessage;

	public constructor(id: string, ws: WebSocket, req: HTTP.IncomingMessage) {

		this.id = id;
		this.ws = ws;
		this.request = req;

	}

	public send(value: any): void {



	}

}

class Server {

	private readonly server: WebSocket.Server;
	private sockets: ECMap<string, Socket>;
	private commands: ECMap<string, Command>;
	private authorizationHandler: ((socket: Socket) => Promise<void>) | undefined;

	public constructor(options?: WebSocket.ServerOptions) {

		this.server = new WebSocket.Server(options);
		this.commands = new ECMap<string, Command>();
		this.sockets = new ECMap<string, Socket>();
		this.server.on("connection", this.handleNewConnection);

	}

	private handleNewConnection(ws: WebSocket, req: HTTP.IncomingMessage): void {

		const id: string = this.generateId();
		const socket: Socket = new Socket(id, ws, req);

		ws.on("message", (message: WebSocket.Data) => {

			let messageString: string = "{}";
			if (message instanceof Buffer) messageString = message.toString("utf8");
			else if (typeof message === "string") messageString = message;

			const messageObject: object = JSON.parse(messageString);

			// run this messageObject through typeif to verify it is command, meta, and data

			// check if a Command exists for the cmd found

			// run the data that is in the messageObject through to follow typevalidator on Request

			// run the handler for the request

			// attatch the request ot the response returned by the handler

			// find the correct request and then device from the request attatched to know which device to send it to

			// MAKE SURE TO HAVE ERROR HANDLING HERE - have a ECSError like system for this.
			// MAKE SURE TO HAVE ID system for request and response ids to make sure they don't duplicate...
		});

		ws.on("close", (code: number, reason: string) => {

			console.log(`Closed socket with exit code '${code}' and message '${reason}'.`);
			this.removeSocket(socket);

		});

		this.sockets.set(id, socket);

	}

	private generateId(): string {

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

}

const server: Server = new Server({ port: 8080 });

server.setAuthorizationHandler(async (socket: Socket): Promise<void> => {



});

server.register(new Command("x", {}, async(req: Request): Promise<Response> => {



	return new Response(req, {});

}));

// const wss: WebSocket.Server = new WebSocket.Server({ port: 8080 });
// wss.on("connection", Socket.createNewSocket);
// wss.on("connection", (ws: WebSocket, req: HTTP.IncomingMessage) => {
//
// 	ws.on("message", (message: WebSocket.Data) => {
//
// 		console.log("received: %s", message);
//
// 	});
//
//
// 	ws.on("close", (code: number, reason: string) => {
//
// 		console.log("closed: %s %s", code, reason);
//
// 	});
//
//
// 	ws.send("something");
//
// });