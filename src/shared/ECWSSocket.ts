/**
 *
 * Elijah Cobb
 * elijah@elijahcobb.com
 * https://elijahcobb.com
 *
 */

import { Dictionary } from "@ejc-tsds/dictionary";
import {ECWSCommand} from "./ECWSCommand";
import {StandardType, ObjectType} from "typit";
import { ECWSIMessage, ECWSIMeta, ECWSIError, ECWSIMessageResponse } from "./ECWSInterfaces";

export abstract class ECWSSocket {

	public commands: Dictionary<string, ECWSCommand>;

	protected constructor() {

		this.commands = new Dictionary<string, ECWSCommand>();

	}

	public async handleIncomingData(data: Buffer): Promise<void> {



	}

	public async send(command: string, payload: object | Buffer): Promise<void> {



	}

}