globalThis.playerActor1 = {
    user : {
        "name": "Actor1",
        "type": "user",
        "_id": "gKWWWSPiazIF6UgK",
        "img": "icons/svg/mystery-man.svg",
        "system": {
            "health": {
                "dtype": "Resource",
                "label": "Health",
                "original": 0,
                "min": 0,
                "max": 0
            },
            "attributes": {
                "stats": {
                    "body": {
                        "dtype": "Number",
                        "label": "Body",
                        "value": 0,
                        "special": [],
                        "group": "ustats"
                    },
                    "luck": {
                        "dtype": "Burn",
                        "group": "ustats",
                        "label": "Luck",
                        "value": 0,
                        "temp": 0,
                        "perm": 0
                    },
                    "menacing": {
                        "dtype": "Number",
                        "label": "Menacing",
                        "value": 0,
                        "special": [],
                        "group": "ustats"
                    },
                    "pluck": {
                        "dtype": "Number",
                        "label": "Pluck",
                        "value": 0,
                        "special": [],
                        "group": "ustats"
                    },
                    "reason": {
                        "dtype": "Number",
                        "label": "Reason",
                        "value": 0,
                        "special": [],
                        "group": "ustats"
                    },
                    "wit": {
                        "dtype": "Number",
                        "label": "Wit",
                        "value": 0,
                        "special": [],
                        "group": "ustats"
                    }
                }
            },
            "bio": {
                "name": "",
                "linkedActors": {
                    "dtype": "Array",
                    "label": "Abilities",
                    "value": [
                        {
                            "uuid": "Actor.Jf4BWMCFP2UB7fpa",
                            "name": "Actor1",
                            "type": "stand"
                        },
                        {
                            "uuid": "Actor.YpKyHS1j4ObtzL1P",
                            "name": "Actor1",
                            "type": "power"
                        }
                    ]
                },
                "gender": "",
                "dob": "",
                "hitLimit": 0,
                "appearance": "",
                "personality": "",
                "philosophy": "",
                "backstory": "",
                "type": "None"
            }
        },
        "prototypeToken": {
            "name": "Actor1",
            "displayName": 0,
            "actorLink": false,
            "width": 1,
            "height": 1,
            "depth": 1,
            "texture": {
                "src": "icons/svg/mystery-man.svg",
                "anchorX": 0.5,
                "anchorY": 0.5,
                "fit": "contain",
                "scaleX": 1,
                "scaleY": 1,
                "tint": "#ffffff",
                "alphaThreshold": 0.75
            },
            "lockRotation": false,
            "rotation": 0,
            "alpha": 1,
            "disposition": -1,
            "displayBars": 0,
            "bar1": {
                "attribute": "hits"
            },
            "bar2": {
                "attribute": "luck"
            },
            "light": {
                "negative": false,
                "priority": 0,
                "alpha": 0.5,
                "angle": 360,
                "bright": 0,
                "color": null,
                "coloration": 1,
                "dim": 0,
                "attenuation": 0.5,
                "luminosity": 0.5,
                "saturation": 0,
                "contrast": 0,
                "shadows": 0,
                "animation": {
                    "type": null,
                    "speed": 5,
                    "intensity": 5,
                    "reverse": false
                },
                "darkness": {
                    "min": 0,
                    "max": 1
                }
            },
            "sight": {
                "enabled": false,
                "range": 0,
                "angle": 360,
                "visionMode": "basic",
                "color": null,
                "attenuation": 0.1,
                "brightness": 0,
                "saturation": 0,
                "contrast": 0
            },
            "detectionModes": {},
            "occludable": {
                "radius": 0
            },
            "ring": {
                "enabled": false,
                "colors": {
                    "ring": null,
                    "background": null
                },
                "effects": 1,
                "subject": {
                    "scale": 1,
                    "texture": null
                }
            },
            "turnMarker": {
                "mode": 1,
                "animation": null,
                "src": null,
                "disposition": false
            },
            "movementAction": null,
            "flags": {},
            "randomImg": false,
            "appendNumber": false,
            "prependAdjective": false
        },
        "items": [],
        "effects": [],
        "folder": "HwsfW6Dt0LuYOXBi",
        "sort": 100000,
        "ownership": {
            "default": 0,
            "fK6rCIIbvMSgKnbz": 3
        },
        "flags": {},
        "_stats": {
            "coreVersion": "14.364",
            "systemId": "bizarre-adventures-d6",
            "systemVersion": "0.9.14.3",
            "createdTime": 1788024023889,
            "modifiedTime": 1788024337590,
            "lastModifiedBy": "fK6rCIIbvMSgKnbz",
            "compendiumSource": null,
            "duplicateSource": "Actor.gKWWWSPiazIF6UgK",
            "exportSource": null
        }
    },

    stand : {
        "name": "Actor1",
        "type": "stand",
        "_id": "Jf4BWMCFP2UB7fpa",
        "img": "icons/svg/mystery-man.svg",
        "system": {
            "attributes": {
                "stats": {
                    "durability": {
                        "dtype": "Number",
                        "label": "Durability",
                        "value": 0,
                        "special": [],
                        "group": "sstats"
                    },
                    "learning": {
                        "dtype": "Burn",
                        "label": "Learning",
                        "original": 0,
                        "temp": 0,
                        "perm": 0,
                        "group": "sstats"
                    },
                    "power": {
                        "dtype": "Number",
                        "label": "Power",
                        "value": 0,
                        "special": [],
                        "group": "sstats"
                    },
                    "precision": {
                        "dtype": "Number",
                        "label": "Precision",
                        "value": 0,
                        "special": [],
                        "group": "sstats"
                    },
                    "range": {
                        "dtype": "Number",
                        "label": "Range",
                        "value": 0,
                        "special": [],
                        "group": "sstats"
                    },
                    "speed": {
                        "dtype": "Number",
                        "label": "Speed",
                        "value": 0,
                        "special": [],
                        "group": "sstats"
                    }
                }
            },
            "bio": {
                "standName": "",
                "linkedActors": {
                    "dtype": "Array",
                    "label": "Users",
                    "value": [
                        {
                            "uuid": "Actor.gKWWWSPiazIF6UgK",
                            "name": "Actor1",
                            "type": "user"
                        }
                    ]
                },
                "type": "None",
                "design": "",
                "ability": "",
                "cost": ""
            }
        },
        "prototypeToken": {
            "name": "Actor1",
            "displayName": 0,
            "actorLink": false,
            "width": 1,
            "height": 1,
            "depth": 1,
            "texture": {
                "src": "icons/svg/mystery-man.svg",
                "anchorX": 0.5,
                "anchorY": 0.5,
                "fit": "contain",
                "scaleX": 1,
                "scaleY": 1,
                "tint": "#ffffff",
                "alphaThreshold": 0.75
            },
            "lockRotation": false,
            "rotation": 0,
            "alpha": 1,
            "disposition": -1,
            "displayBars": 0,
            "bar1": {
                "attribute": "hits"
            },
            "bar2": {
                "attribute": "luck"
            },
            "light": {
                "negative": false,
                "priority": 0,
                "alpha": 0.5,
                "angle": 360,
                "bright": 0,
                "color": null,
                "coloration": 1,
                "dim": 0,
                "attenuation": 0.5,
                "luminosity": 0.5,
                "saturation": 0,
                "contrast": 0,
                "shadows": 0,
                "animation": {
                    "type": null,
                    "speed": 5,
                    "intensity": 5,
                    "reverse": false
                },
                "darkness": {
                    "min": 0,
                    "max": 1
                }
            },
            "sight": {
                "enabled": false,
                "range": 0,
                "angle": 360,
                "visionMode": "basic",
                "color": null,
                "attenuation": 0.1,
                "brightness": 0,
                "saturation": 0,
                "contrast": 0
            },
            "detectionModes": {},
            "occludable": {
                "radius": 0
            },
            "ring": {
                "enabled": false,
                "colors": {
                    "ring": null,
                    "background": null
                },
                "effects": 1,
                "subject": {
                    "scale": 1,
                    "texture": null
                }
            },
            "turnMarker": {
                "mode": 1,
                "animation": null,
                "src": null,
                "disposition": false
            },
            "movementAction": null,
            "flags": {},
            "randomImg": false,
            "appendNumber": false,
            "prependAdjective": false
        },
        "items": [],
        "effects": [],
        "folder": "HwsfW6Dt0LuYOXBi",
        "sort": 200000,
        "ownership": {
            "default": 0,
            "fK6rCIIbvMSgKnbz": 3
        },
        "flags": {},
        "_stats": {
            "coreVersion": "14.364",
            "systemId": "bizarre-adventures-d6",
            "systemVersion": "0.9.14.3",
            "createdTime": 1788024041229,
            "modifiedTime": 1788024330972,
            "lastModifiedBy": "fK6rCIIbvMSgKnbz",
            "compendiumSource": null,
            "duplicateSource": "Actor.Jf4BWMCFP2UB7fpa",
            "exportSource": null
        }
    },

    power : {
        "name": "Actor1",
        "type": "power",
        "_id": "YpKyHS1j4ObtzL1P",
        "img": "icons/svg/mystery-man.svg",
        "system": {
            "attributes": {
                "stats": {
                    "durability": {
                        "dtype": "Number",
                        "label": "Durability",
                        "value": 0,
                        "special": [],
                        "group": "sstats"
                    },
                    "learning": {
                        "dtype": "Burn",
                        "label": "Learning",
                        "original": 0,
                        "temp": 0,
                        "perm": 0,
                        "group": "sstats"
                    },
                    "power": {
                        "dtype": "Number",
                        "label": "Power",
                        "value": 0,
                        "special": [],
                        "group": "sstats"
                    },
                    "precision": {
                        "dtype": "Number",
                        "label": "Precision",
                        "value": 0,
                        "special": [],
                        "group": "sstats"
                    },
                    "range": {
                        "dtype": "Number",
                        "label": "Range",
                        "value": 0,
                        "special": [],
                        "group": "sstats"
                    },
                    "speed": {
                        "dtype": "Number",
                        "label": "Speed",
                        "value": 0,
                        "special": [],
                        "group": "sstats"
                    }
                }
            },
            "bio": {
                "powerName": "",
                "linkedActors": {
                    "dtype": "Array",
                    "label": "Users",
                    "value": [
                        {
                            "uuid": "Actor.gKWWWSPiazIF6UgK",
                            "name": "Actor1",
                            "type": "user"
                        }
                    ]
                },
                "type": "None",
                "design": "",
                "ability": ""
            }
        },
        "prototypeToken": {
            "name": "Actor1",
            "displayName": 0,
            "actorLink": false,
            "width": 1,
            "height": 1,
            "depth": 1,
            "texture": {
                "src": "icons/svg/mystery-man.svg",
                "anchorX": 0.5,
                "anchorY": 0.5,
                "fit": "contain",
                "scaleX": 1,
                "scaleY": 1,
                "tint": "#ffffff",
                "alphaThreshold": 0.75
            },
            "lockRotation": false,
            "rotation": 0,
            "alpha": 1,
            "disposition": -1,
            "displayBars": 0,
            "bar1": {
                "attribute": "hits"
            },
            "bar2": {
                "attribute": "luck"
            },
            "light": {
                "negative": false,
                "priority": 0,
                "alpha": 0.5,
                "angle": 360,
                "bright": 0,
                "color": null,
                "coloration": 1,
                "dim": 0,
                "attenuation": 0.5,
                "luminosity": 0.5,
                "saturation": 0,
                "contrast": 0,
                "shadows": 0,
                "animation": {
                    "type": null,
                    "speed": 5,
                    "intensity": 5,
                    "reverse": false
                },
                "darkness": {
                    "min": 0,
                    "max": 1
                }
            },
            "sight": {
                "enabled": false,
                "range": 0,
                "angle": 360,
                "visionMode": "basic",
                "color": null,
                "attenuation": 0.1,
                "brightness": 0,
                "saturation": 0,
                "contrast": 0
            },
            "detectionModes": {},
            "occludable": {
                "radius": 0
            },
            "ring": {
                "enabled": false,
                "colors": {
                    "ring": null,
                    "background": null
                },
                "effects": 1,
                "subject": {
                    "scale": 1,
                    "texture": null
                }
            },
            "turnMarker": {
                "mode": 1,
                "animation": null,
                "src": null,
                "disposition": false
            },
            "movementAction": null,
            "flags": {},
            "randomImg": false,
            "appendNumber": false,
            "prependAdjective": false
        },
        "items": [],
        "effects": [],
        "folder": "HwsfW6Dt0LuYOXBi",
        "sort": 150000,
        "ownership": {
            "default": 0,
            "fK6rCIIbvMSgKnbz": 3
        },
        "flags": {},
        "_stats": {
            "coreVersion": "14.364",
            "systemId": "bizarre-adventures-d6",
            "systemVersion": "0.9.14.3",
            "createdTime": 1788024052942,
            "modifiedTime": 1788024337604,
            "lastModifiedBy": "fK6rCIIbvMSgKnbz",
            "compendiumSource": null,
            "duplicateSource": "Actor.YpKyHS1j4ObtzL1P",
            "exportSource": null
        }
    }
};