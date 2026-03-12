export const actionLabels = [ 
    {side:"action", quadrant: 1, label: "Action Setup"}
    , {side:"action", quadrant: 2, label: "Action"}
    , {side:"reaction", quadrant: 3, label: "Reaction Setup"}
    , {side:"reaction", quadrant: 4, label: "Reaction"}
]

export const LUCK_MOVE_HINTS = {
    GAMBIT_HINT: "In order to Gambit, right click a luck action (twice for most setups)."
}

export const HitDC = {
    0 : "None",
	
	1 : "Minor",

	2 : "Moderate",

	3 : "Serious",

	4 : "Debilitating",

	5 : "Critical",

	6 : "Macabre",

	7 : "Grindhouse",

    default : "Grindhouse"
}

export const HitDCFlavor = {
    0 : "Kars smacks Joseph on the head. Not a Hit.",

    1 : "Kars cuts Joseph’s finger nerves, numbing them.",

    2 : "Kars crushes Joseph’s wrist bone, leaving the hand limp.",

    3 : "Kars tears through Joseph’s arm muscles, disabling it.",

    4 : "Kars carves into Joseph’s ribs, puncturing his pleural layers.",

    5 : "Kars slices Joseph’s arm clean off, from the shoulder.",

    6 : "Kars plunges through Joseph’s chest and bisects his right lung.",

    7 : "Kars bisects Joseph’s spine, nerves and all.",

    default : "Kars bisects Joseph’s spine, nerves and all."
}

/*
DC Table
#
	Difficulty Of Task
	Situation and Example
	

0
	Trivial
	No dice are rolled, as it isn’t an urgent danger.
Jotaro tries to drink water without a straw.
	1
	Easy
	Can be done with a healthy amount of effort.
Jotaro tries to push a bookcase away from a wall.
	2
	Challenging
	Accomplishable with difficulty.
Jotaro tries to break through a locked door.
	3
	Dire
	A strenuous action, requiring intense focus.
Jotaro dodges a surprise arrow fired 15 feet away.
	4
	Herculean
	The average person would struggle greatly.
Jotaro stands up after an explosion.
	5
	Extraordinary
	A jaw-dropping feat of talent.
Star Platinum catches a bullet.
	6
	Superhuman
	Past the borders of humanity.
Star Platinum pushes a falling steamroller into the air.
	7
	Unbelievable
	Challenging suspension of disbelief.
Star Platinum dodges something at FTL speed.
	8
	Surreal
	Stretching the limits of reality itself.
Star Platinum fist clenches a ball of graphite into a diamond.
	9
	Absurd
	Rolling a critical in real life.
Star Platinum throws a stone 4 miles away, has it rebound off of a plane, and hit Dio in the chest.
	 10+
	Nigh-Impossible
	Unachievable in all but theory.
Star Platinum adds an extra second to the earth’s day with a punch.
	15+
	Impossible
	Can not be done.
*/

export const DC = {
    0 : "Trivial",

    1 : "Easy",

    2 : "Challenging",

    3 : "Dire",

    4 : "Herculean",

    5 : "Extraordinary",

    6 : "Superhuman",

    7 : "Unbelievable",

    8 : "Surreal",

    9 : "Absurd",

    10 : "Nigh-Impossible",

    11 : "Nigh-Impossible",

    12 : "Nigh-Impossible",

    13 : "Nigh-Impossible",

    14 : "Nigh-Impossible",

    15 : "Impossible",

    default: "Impossible"

}

export const DCDifficulty = {

    0 : "No dice are rolled, as it isn’t an urgent danger.",

    1 : "Can be done with a healthy amount of effort.",

    2 : "Accomplishable with difficulty.",

    3 : "A strenuous action, requiring intense focus.",

    4 : "The average person would struggle greatly.",

    5 : "A jaw-dropping feat of talent.",

    6 : "Past the borders of humanity.",

    7 : "Challenging suspension of disbelief.",

    8 : "Stretching the limits of reality itself.",

    9 : "Rolling a critical in real life.",

    10 : "Unachievable in all but theory.",

    11 : "Unachievable in all but theory.",

    12 : "Unachievable in all but theory.",

    13 : "Unachievable in all but theory.",

    14 : "Unachievable in all but theory.",

    15 : "Can not be done.",

    default: "Can not be done."
}

export const DCFlavor = {
    0: "Jotaro tries to drink water without a straw.",
    
    1: "Jotaro tries to push a bookcase away from a wall.",

    2: "Jotaro tries to break through a locked door.",

    3: "Jotaro dodges a surprise arrow fired 15 feet away.",

    4: "Jotaro stands up after an explosion.",

    5: "Star Platinum catches a bullet.",

    6: "Star Platinum pushes a falling steamroller into the air.",

    7: "Star Platinum dodges something at FTL speed.",

    8: "Star Platinum fist clenches a ball of graphite into a diamond.",

    9: "Star Platinum throws a stone 4 miles away, has it rebound off of a plane, and hit Dio in the chest.",

    10: "Star Platinum adds an extra second to the earth’s day with a punch.",

    11: "Star Platinum adds an extra second to the earth’s day with a punch.",

    12: "Star Platinum adds an extra second to the earth’s day with a punch.",

    13: "Star Platinum adds an extra second to the earth’s day with a punch.",

    14: "Star Platinum adds an extra second to the earth’s day with a punch.",

    15: "Can not be done.",

    default: "Can not be done."
}