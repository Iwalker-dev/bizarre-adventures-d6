const { ObjectField, StringField, NumberField } = foundry.data.fields;

function objectField(initial) {
	return new ObjectField({ initial });
}

class UserActorDataModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			health: objectField({
				dtype: "Resource",
				label: "Health",
				original: 0,
				min: 0,
				max: 0
			}),
			attributes: objectField({
				stats: {
					body: { dtype: "Number", label: "Body", value: 0, special: [], group: "ustats" },
					luck: { dtype: "Burn", group: "ustats", label: "Luck", value: 0, temp: 0, perm: 0 },
					menacing: { dtype: "Number", label: "Menacing", value: 0, special: [], group: "ustats" },
					pluck: { dtype: "Number", label: "Pluck", value: 0, special: [], group: "ustats" },
					reason: { dtype: "Number", label: "Reason", value: 0, special: [], group: "ustats" },
					wit: { dtype: "Number", label: "Wit", value: 0, special: [], group: "ustats" }
				}
			}),
			bio: objectField({
				name: "",
				linkedActors: { dtype: "Array", label: "Abilities", value: [] },
				gender: "",
				dob: "",
				hitLimit: 0,
				appearance: "",
				personality: "",
				philosophy: "",
				backstory: ""
			})
		};
	}
}

class StandActorDataModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			attributes: objectField({
				stats: {
					durability: { dtype: "Number", label: "Durability", value: 0, special: [], group: "sstats" },
					learning: { dtype: "Burn", label: "Learning", original: 0, temp: 0, perm: 0, group: "sstats" },
					power: { dtype: "Number", label: "Power", value: 0, special: [], group: "sstats" },
					precision: { dtype: "Number", label: "Precision", value: 0, special: [], group: "sstats" },
					range: { dtype: "Number", label: "Range", value: 0, special: [], group: "sstats" },
					speed: { dtype: "Number", label: "Speed", value: 0, special: [], group: "sstats" }
				}
			}),
			bio: objectField({
				standName: "",
				linkedActors: { dtype: "Array", label: "Users", value: [] },
				type: "",
				design: "",
				ability: "",
				cost: ""
			})
		};
	}
}

class PowerActorDataModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			attributes: objectField({
				stats: {
					durability: { dtype: "Number", label: "Durability", value: 0, special: [], group: "sstats" },
					learning: { dtype: "Burn", label: "Learning", original: 0, temp: 0, perm: 0, group: "sstats" },
					power: { dtype: "Number", label: "Power", value: 0, special: [], group: "sstats" },
					precision: { dtype: "Number", label: "Precision", value: 0, special: [], group: "sstats" },
					range: { dtype: "Number", label: "Range", value: 0, special: [], group: "sstats" },
					speed: { dtype: "Number", label: "Speed", value: 0, special: [], group: "sstats" }
				}
			}),
			bio: objectField({
				powerName: "",
				linkedActors: { dtype: "Array", label: "Users", value: [] },
				type: "",
				design: "",
				ability: ""
			})
		};
	}
}

class ItemDataModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			type: new StringField({ initial: "item" }),
			description: new StringField({ initial: "" }),
			quantity: new NumberField({ initial: 1 }),
			weight: new NumberField({ initial: 0 }),
			attributes: objectField({}),
			groups: objectField({})
		};
	}
}

class HitItemDataModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			type: new StringField({ initial: "hit" }),
			description: new StringField({ initial: "" }),
			quantity: new NumberField({ initial: 1 }),
			severity: new NumberField({ initial: 0 })
		};
	}
}

class GambitItemDataModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			type: new StringField({ initial: "gambit" }),
			trigger: new StringField({ initial: "" }),
			luckMove: new StringField({ initial: "" }),
			notes: new StringField({ initial: "" })
		};
	}
}

export function registerDocumentDataModels() {
	Object.assign(CONFIG.Actor.dataModels, {
		user: UserActorDataModel,
		stand: StandActorDataModel,
		power: PowerActorDataModel
	});
	Object.assign(CONFIG.Item.dataModels, {
		item: ItemDataModel,
		hit: HitItemDataModel,
		gambit: GambitItemDataModel
	});
}
