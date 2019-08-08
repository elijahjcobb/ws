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
import {ECWSRequest} from "./ECWSRequest";
import {Dictionary} from "@ejc-tsds/dictionary";
import {ECWSCommand} from "./ECWSCommand";

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

export interface ECWSIMessageResponse<P = object> {
	request: ECWSRequest;
	response: {
		meta: ECWSIMeta;
		payload?: P;
		error?: ECWSIError;
	};
}

export interface ECWSCommandable {
	commands: Dictionary<string, ECWSCommand>;
}

export interface ECWSParser {
	handleIncoming(data: Buffer): void;
}