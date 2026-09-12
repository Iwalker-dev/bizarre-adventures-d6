export const welcomeText = `
    <h2>Welcome to BAD6!</h2>
    <h3>For Google Doc version V0.9</h3>
    <p> Controls: </p>
        <ul>
            <li>🎲 Use the "D6 Roller" in <a href="https://foundryvtt.com/article/tokens/" target="_blank" rel="noopener noreferrer">token controls</a> for actions. Double click for Contests.</li>
            <li>🎲❗ Note: Your messsage/<a href="https://foundryvtt.com/article/chat/" target="_blank" rel="noopener noreferrer">roll mode</a> when clicking a button decides who can see it!</li>
            <li>🎲 As a GM, your highlighted tokens are the roll's context.</li>
            <li>🎯 As a player your owned actors are the roll's context.</li>
            <li>🎯 Contest rolls are resolved in the same chat message; use the buttons in each quadrant.</li>
            <li>🔧 Hue Shift - Within Lighting controls, click the "Hue Shift Canvas" button to shift the hue 30 degrees. By default, use ctrl+h to reset the hue</li>
            <li>🌟 To Be Continued - Click the button to place the animation over all screens, turning off all current music. Create a Scene called "Outro" and it will automatically switch to it afterwards.</li>
            <li>🧑 Old Actors - On each load, actors will be automatically moved to a type (if set up properly in the Worldbuilding version.).</li>
        </ul>
        <p> This system is unfinished! Certain features are not yet implemented such as...</p>
        <ul>
            <li> Learning Automation (Including advantages from Hamon).</li>
            <li> (View the changelog for longer list) </li>
        </ul>
    <p> Please report any problems, ideas, or comments to itpart on Discord as I try to handle them quickly. I would love to make this the perfect system with your help!
    <p> <a href="https://discordapp.com/invite/2QVASDt" target="_blank" rel="noopener noreferrer">Official Bizarre Adventures Discord</a></p>
    <p>	<a href="https://discord.gg/f6t3tGMgMD" target="_blank" rel="noopener noreferrer">FoundryVTT System's Discord</a>  </p>`

export const actionLabels = [ 
    {side:"action", quadrant: 1, label: "Action"}
    , {side:"action", quadrant: 2, label: ""}
    , {side:"reaction", quadrant: 3, label: "Reaction"}
    , {side:"reaction", quadrant: 4, label: ""}
]

export const LUCK_MOVE_HINTS = {
    GAMBIT_HINT: "In order to Gambit, right click a luck action (twice for most setups)."
}

export const HitDC = {
    0 : "0 - None",
	
	1 : "+1 - Minor",

	2 : "+2 - Moderate",

	3 : "+3 - Serious",

	4 : "+4 - Debilitating",

	5 : "+5 - Critical",

	6 : "+6 - Macabre",

	7 : "+7 - Grindhouse",

    default : "7+ - Grindhouse"
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
    0 : "0 - Trivial",

    1 : "1 - Easy",

    2 : "2 - Challenging",

    3 : "3 - Dire",

    4 : "4 - Herculean",

    5 : "5 - Extraordinary",

    6 : "6 - Superhuman",

    7 : "7 - Unbelievable",

    8 : "8 - Surreal",

    9 : "9 - Absurd",

    10 : "10 - Nigh-Impossible",

    11 : "11 - Nigh-Impossible",

    12 : "12 - Nigh-Impossible",

    13 : "13 - Nigh-Impossible",

    14 : "14 - Nigh-Impossible",

    15 : "15 - Impossible",

    default: "15+ - Impossible"

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

export const luckTooltips = {
    feint: "Feint (-1 Temp) - Edit your Action/Reaction after hearing the enemy's, pre-roll.\nInstead of going for the left hook, I'll read their block and trip instead…",
    fudge: "Fudge (-2 Temp) - Add a free Advantage, pre-roll.\nFingers crossed. Cannot go over the total Advantage max of +3.",
    flashback: "Flashback (-3 Temp) - The Narrator 'forgot' a detail you choose and retcons it in. \nMaybe there were bullets in the gun... Maybe you did have a trap buried…",
    mulligan: "Mulligan (-4 Temp) - Add a free Advantage, post-roll. \nA little spice when nobody's looking… Advantage max of +3 still applies.",
    persist: "Try another Action/Reaction after a failed one post-roll, as if it tied.\nConsequences of the initial fumble may change the scenario for the worse, but no hit.",
    gambit: "Gambit (1/2) - Luck Cost of anything = 0 if successful."
}

export const differenceStars = {
    3: "☆☆☆",
    2: "☆☆",
    1: "☆",
    0: "?",
    [-1]: "☆",
    [-2]: "☆☆",
    [-3]: "☆☆☆"
}

export const differenceType = {
    3: "☆OVERPOSE☆",
    2: "Extra Success",
    1: "Success",
    0: "Bizarre",
    [-1]: "Failure",
    [-2]: "Extra Failure",
    [-3]: "☆UNDERPOSE☆"
}

export const differenceResult = {
    3: "Yes, and give me a detail.",
    2: "Yes, and it gets better.",
    1: "Yep.",
    0: "Something else...",
    [-1]: "Nope.",
    [-2]: "No, and it gets worse.",
    [-3]: "Fail forwards/add twist"
}

export const differenceExample = {
    3: "Where does this door actually lead?",
    2: "You rip the door clean off the hinges",
    1: "You punch the door open.",
    0: "The door changes color? What!?",
    [-1]: "The door stays shut.",
    [-2]: "You get splinters in your eye.",
    [-3]: "You punch the wall, revealing…"
}