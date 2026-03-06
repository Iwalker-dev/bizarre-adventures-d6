/**
 * Dialog lifecycle utilities for roller flows.
 */

import { ROLLER_DIALOG_CLASS, ROLLER_DIALOG_IDS } from "../../dialog.js";

const CONTEST_DIALOG_IDS = new Set(Object.values(ROLLER_DIALOG_IDS));

/**
 * Close all dialogs related to the contest.
 * @returns {void}
 */
export function closeContestDialogs() {
	const openDialogs = Object.values(ui.windows).filter(d => d instanceof Dialog);
	for (const dialog of openDialogs) {
		const root = dialog.element?.[0];
		const dialogId = root?.dataset?.bad6DialogId || "";
		const hasRollerClass = !!root?.classList?.contains(ROLLER_DIALOG_CLASS);
		if ((dialogId && CONTEST_DIALOG_IDS.has(dialogId)) || hasRollerClass) {
			dialog.close();
		}
	}
}
