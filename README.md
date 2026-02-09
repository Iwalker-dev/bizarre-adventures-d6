It is recommended to run with Lancer Initiative for better control over combat initiative.

The 'Unreleased' branch will always have the most up to date version of the system.

**Features:**

Actors:

-Outro, Hue Shift, and Rolling functionality

-Customized Sheet

-Simple, Stylized Stat viewing and editing

-Simplified viewing of Burn type stats (Learning, Luck)

-Hit rendering and auto calculation of damage to health

-Simple item implementation

-Direct locations to fill in character information

-Dark Determination Implementation

**Known limitations**

-Changes to the sheet can be resource intensive for lower end devices

**Some Future Additions:**

Cleaner Sheet Look

Optimization option for lower-end devices

Customized Combat
    Combat based on Lancer Initiative
        Alternate options for freedom of choice

Random Character Generator (Would require a resource)

Enter the system into FoundryVTT

**Use Info**

Hue Shift - Within Lighting controls, click the "Hue Shift Canvas" button to shift the hue 30 degrees. By default, use ctrl+h to reset the hue.

To Be Continued - Click the button to place the animation over all screens, turning off all current music. Create a Scene called Outro and it will automatically switch to it afterwards.

Roller - Rolls happen once, then continue via buttons in the same chat message.
- GM: Select 1 token for the action roll. If multiple tokens are highlighted it starts a contest.
- Player: If you have a target, it starts a contest. Otherwise, roll from owned actors.
- Contest rolls are resolved in the same chat message using the quadrant buttons (Action/Reaction, Roll 1/2).
- Second rolls only resolve when their quadrant button is clicked.
- Dice So Nice animations are supported.

Luck - Feint/Fudge are pre-roll. Mulligan/Persist appear after the second roll.
- Fudge affects the current roll and the immediately following roll.

Actor Sheets - Navigate the tabs to fill in or view information related to your actor's type. Use your Foundry color to alter the color of your own sheets for all viewers.

Power Sheet - For all non-stand abilities.
Stand Sheet - For all stand abilities.
User Sheet - For all user types.

I have attempted to make it capable of automatically updating sheets from the Worldbuilding version to this system. Remember to backup your files before trying this:

1) Navigate to your user data folder (doable by right clicking the foundry application)
2) Enter data, then worlds, then click the folder of the world you're changing (note the name by default is based on the ORIGINAL name of the world)
3) Open the "world.json" file with a supporting application (text editors should work)
4) Find "system" under packs and change it from worldbuilding to bizarre-adventures-d6
5) Save, then close and reopen foundry. My system will automatically attempt to fix your actors to the new version. If at any point they don't render the actor sheet, reload.

Alternatively, import the actor then reload the game.

Remember, if you have any questions, comments, ideas, etc. let itpart know on Discord!
