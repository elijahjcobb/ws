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
import {ECWSServer} from "../server/ECWSServer";
import { ECWSResponse} from "../shared/ECWSResponse";
import {ECWSIMessage, ECWSIMessageResponse} from "../shared/ECWSInterfaces";
import {ECWSRequest} from "../shared/ECWSRequest";
import {ECWSCommand} from "../shared/ECWSCommand";
import {ECWSError} from "../shared/ECWSError";
import {ObjectType, StandardType} from "typit";

export class ECWSSocketClient {

	private commands: ECMap<string, ECWSCommand>;
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

	public async handleIncomingMessage(message: Buffer): Promise<void> {

		const messageDecoded: string = message.toString("utf8");

		let messageObject: ECWSIMessage;

		try {
			messageObject = JSON.parse(messageDecoded);
		} catch (e) {
			throw ECWSError.init().msg("The payload was not valid JSON.").code(400).passthrough();
		}

		let objectTypeValidator: ObjectType = new ObjectType({
			cmd: StandardType.STRING,
			meta: new ObjectType(),
			payload: new ObjectType()
		});

		const isMessageValid: boolean = objectTypeValidator.checkConformity(messageObject);
		if (!isMessageValid) return ECWSServer.handleError("Message object not valid."); //TODO add this error...

		const command: ECWSCommand | undefined = this.commands.get(messageObject.cmd);
		if (!command) return;

		const payload: object = messageObject.payload;
		const isPayloadValid: boolean = command.typeValidator.checkConformity(payload);
		if (!isPayloadValid) return ECWSServer.handleError("Payload not valid."); //TODO add this error.

		const request: ECWSRequest = new ECWSRequest(messageObject, command);
		const requestId: string = request.meta.id;

		if (this.openRequests.contains(requestId)) return ECWSServer.handleError("ECWSServer has duplicate request id."); //TODO add this error.
		this.openRequests.add(requestId);

		command.handler(request).then((response: ECWSResponse) => {

			response.request = request;
			response.meta = {
				timestamp: Date.now(),
				id: requestId
			};
			this.send(response);

			this.openRequests.removeValue(requestId);

		}).catch((err: any) => {

			ECWSServer.handleError(err);

		});

	}

	public send(value: ECWSResponse): void {

		const request: ECWSRequest | undefined = value.request;
		if (!request) return ECWSServer.handleError(""); //TODO handle error
		if (!value.meta) return ECWSServer.handleError(""); //TODO handle error

		let obj: ECWSIMessageResponse = {
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

			return ECWSServer.handleError(""); //TODO Handler error.

		}

		this.ws.send(data);

	}

}