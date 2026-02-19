// modules/config.js
export const BAD6 = {};
export const DEBUG_LOGS = false;


// Core Configuration


BAD6.attributes = {
  Test: "TEST!"
};

// Actor Type Configurations

export const typeConfigs = {
	user: {
		None: {
			label: ""
			, cost: "None"
			, description: "A non-stand user, with no special powers or abilities."
		}
		, Natural: {
			label: "Natural User"
			, cost: "None"
			, description: "A Natural-born stand user, drawn by fate for a mysterious purpose."
		}
		, Freak: {
			label: "Freak"
      , fields: [
        {
          name: "cost"
          , label: "Trait Cost"
          , type: "text"
          , placeholder: "1-3 User Points"
        }
        , {
          name: "Trait"
          , label: "Trait Description"
          , type: "textarea"
        }
      ]
      , cost: "1-3 User Points"
			, description: `
        <p><em><u>Freak ⚕</u></em></p>
        <p>Someone with anomalous powers that defy explanation, not tied to a Power Source.</p>
        <p>Traits that are just <em>strange</em> do not need to be paid for; they can be included in a Bio.</p>
        <p><em>Ex. Bruford's Danse Macab-Hair, Mrs. Robinson's bugs, Diavolo's dual souls.</em></p>
      `
		}
		, Ghost: {
			label: "Ghost"
			, cost: "2 User Points"
			, description: `
        <p><em><u>Ghost 👻</u></em></p>
        <p>A spirit of the dead, tied to the mortal world by an <em>unfulfilled purpose</em>.</p>
        <p>They typically keep whatever injury caused their death as a <em>Mark</em>.</p>
        <p>Ghosts must follow certain <u>Rules</u>:</p>
        <ol>
          <li>Ghosts are on the same level of <em>selective intangibility</em> as Stands.</li>
          <li>Animals and Stand Users can see Ghosts.</li>
          <li>Ghosts cannot be seen by normal people, but can make themselves <em>heard</em>.</li>
          <li>If a Ghost's limb unwillingly touches a living thing, it is <em>severed</em> but not lost.</li>
          <li>Normal objects may be <em>manipulated</em> as normal, but not <em>felt</em> by the ghost.</li>
          <li>When any object is destroyed, its previous form becomes a <em>Ghost Object</em>.</li>
          <li>Ghost Objects can be used by Ghosts, and only <em>affect</em> other non-living spirits.</li>
          <li>Ghosts may only enter a room if let inside, or it is empty.</li>
        </ol>
      `
		}
		, Alien: {
			label: "Alien"
			, cost: "2 User Points"
			, description: `
        <p><em><u>Alien 🛸</u></em></p>
        <p>A shapeshifting <em>extraterrestrial</em>, hailing from the Magellanic Clouds and lost on Earth.</p>
        <p>These beings can <u>Shapeshift</u> into any non-complex object, of equal or lesser mass.</p>
        <p>Aliens have a <em>Sensitivity</em> to high-pitched sounds, and take a Hit on exposure.</p>
        <p>While exposed to sound, the alien's form will be <em>unstable</em>, and change rapidly.</p>
        <p>Aliens may also have access to foreign <em>technologies</em> and weapons based on setting.</p>
        <p>This section is made under the assumption that <u>Mikitaka</u> is <em>not</em> a Stand User.</p>
      `
		, }
		, Rock: {
			label: "Rock Human"
			, cost: "1 User Point"
			, description: `
        <p><em><u>Rock Human 🪨</u></em></p>
        <p>A counterpart to <em>Homo Sapiens</em>, in tune with nature and attracted to '<em>sacred ground</em>'.</p>
        <p><u>Rock Form</u> is used for months-long <u>hibernation</u>, resisting extreme conditions.</p>
        <p>After hibernating, the Rock Human can <em>stay awake</em> for an equal amount of time.</p>

        <p>They all have a <u>mango allergy</u>, and despite being <u>Silicon-based</u> can eat a paleo diet.</p>
        <p>Due to their <em>Incubation</em>, they lack legal identities, prosocial emotions, and childhoods.</p>

        <p>All Rock Organisms can turn parts of their body into a chosen <u>Material</u>.</p>
        <p>Rock Animals/Insects are known to <u>Masquerade</u> as human-made objects.</p>
        <p>Rock Humans are more <em>sophisticated</em> at this, opting for identity theft and fake jobs.</p>
      `
		, }
		, Pillar: {
			label: "Pillar Man"
			, cost: "4 User/4 Stand, Vampire, GM Approval"
			, description: `
        <p><em><u>Pillar Man 🗿</u></em></p>
        <p>A mesoamerican <em>ultra-vampire</em>, horned apex predators from a bygone era.</p>

        <p><u>Higher Being</u> grants <em>double</em> the organ systems from <em>Range</em> ranks, and superior minds.</p>
        <p>The first <u>User Stat</u> roll has <em>double dice</em>; a <strong>Power B/Wit A</strong> roll would be 14d6 in total.</p>
        <p>A Pillar Man that hasn't used a <em>Stone Mask</em> still ages, but lives for <em>thousands</em> of years.</p>
        <p><u>Rock Form</u> can <em>negate</em> instant death from Hamon/Sun exposure, and help hibernate.</p>

        <p><u>After using a Stone Mask</u>, a Pillar Man's <em>innate vampirism</em> and <em>hunger</em> increase greatly.</p>
        <p><u>Superhuman Body</u> lets Pillar Men rearrange their bodies or others at will.</p>
        <p><u>Absorption</u> upgrades Blood Sucking, assimilating live victims on <em>any</em> physical contact.</p>
        <p>Functions evolve into <em>Modes</em> based on an <em>element</em>.</p>
        <p><u>Vampirification</u> - Creates <em>Vampires</em> with <em>Learning</em>, all Abilities, and (Ranks * 5) Points.</p>
      `
		},
		// …other user types…
	},

	stand: {
		None: {
			label: ""
		, }
		, Natural: {
			label: "Natural Stand"
			, cost: "None"
			, description: `
        <p><em><u>Natural 🍃</u></em></p>
        <p>A standard Stand type, with a majorly human or animal physiology with limbs.</p>
        <p>Examples: Star Platinum, Hierophant Green, Grateful Dead, Clash.</p>
      `
		}
		, Artificial: {
			label: "Artificial Stand"
			, cost: "None"
			, description: `
      <p><em><u>Artificial 🤖</u></em></p>
      <p>As opposed to <em>Natural</em>, these Stands have a more abstract or mechanical body.</p>
      <p>Examples: Hermit Purple, Ratt, Aerosmith, Manhattan Transfer.</p>
    `
		}
		, Object: {
			label: "Object Stand"
			, cost: "None"
			, description: `
        <p><em><u>Object 🎁</u></em></p>
        <p>Tools with the Ability tied to them, which can be <em>summoned & withdrawn</em> at will.</p>
        <p>These Stands are known to <em>survive past</em> even the User's death.</p>
        <p><em>Examples: Emperor, Thoth, Cream Starter, Beach Boy.</em></p>
      `
		}
		, Bound: {
			label: "Bound Stand"
			, cost: "None"
			, description: `
        A Stand Ability that assimilates itself into another physical, tangible thing at will.
        Non-users can interact with it, as it's not a pure Stand-type manifestation.
        The enhanced substance is generally manipulable, & cannot be withdrawn.
        Examples: The Fool, Super Fly, Strength, Les Feuilles.
      `
		}
		, Wearable: {
			label: "Wearable Stand"
			, cost: "None"
			, description: `
        Stands worn by the User, often as a suit or accessory.
        These Stands, as with Object Stands, are usually immobile.
        Others can wear the Stand, though Range restricts distance from the User.
        Examples: Oasis, White Album, Catch The Rainbow, Mandom.
      `
		}
		, Swarm: {
			label: "Swarm Stand"
			, cost: "1 Stand Point"
			, description: `
        <p><em><u>Swarm 🐜</u></em></p>
        <p>Swarm Stands are a <em>conglomerate</em> of units, operated by the User at once.</p>
        <p><strong>Power</strong> & <strong>Durability</strong> stats are for the swarm as a <em>whole</em>, partial groups have lower stats.</p>
        <p>Single-unit death does not harm the User, only substantial amounts of lost units do.</p>
        <p><em>Examples: Harvest, Bad Company, Pearl Jam, Metallica, Sex Pistols.</em></p>
      `
		}
		, Integrated: {
			label: "Integrated Stand"
			, cost: "Adds: +2 Stand Points"
			, description: `
        <p><em><u>Integrated ⚙</u></em></p>
        <p>These Stands have no or minimal manifestation.</p>
        <p>Integrated Abilities are applied to the User <em>directly</em>, without a punchghost.</p>
        <p><strong>Durability</strong> & <strong>Range</strong> are often of lesser use without a Stand body.</p>
        <p><em>Examples: Khnum, Stray Cat, Mr. President, Tatoo You!, Oh! Lonesome Me.</em></p>
      `
		}
		, Automatic: {
			label: "Automatic Stand"
			, cost: "Loss of control"
			, description: `
        <p><em><u>Automatic 🎧</u></em></p>
        <p>Stands with <em>simple AI-style behavior</em>, instead of having the User in direct command.</p>
        <p>The manifestation itself typically has no <em>range leash</em>.</p>
        <p><u>Range</u> still applies to the Ability, relative to the target's distance from the Stand.</p>
        <p><u>Precision</u> is often of lesser use, as Automatics choose targets based on a condition.</p>
        <p><em>Examples: Black Sabbath, Marilyn Manson, Born This Way.</em></p>
      `
		}
		, Detached: {
			label: "Detached Stand"
			, cost: "Stand desync"
			, description: `
        <p><em><u>Detached 🧲</u></em></p>
        <p>Stands that do <strong>not</strong> synchronize <em>senses</em> or <em>injuries</em> with their User.</p>
        <p>Most Detached <em>Automatic</em> and <em>Object</em> Stands can respawn when destroyed.</p>
        <p>Most Detached <em>Bound</em> Stands can rebind to their medium of choice when damaged.</p>
        <p>Detached Stands of other types are vulnerable to a <em>Stand Break</em>, which counts as a Hit.</p>
        <p>While a Stand is Broken, its manifestation and ability are unusable.</p>
        <p><em>Examples: Highway Star, Sheer Heart Attack, Baby Face.</em></p>
      `
		}
		, Indepdendent: {
			label: "Independent Stand"
			, cost: "Learning Costs Double (2/4/6/8/10)"
			, description: `
        <p><em><u>Independent 🐱‍👤</u></em></p>
        <p>Stands capable of sentient thought & action, having a mind of their own.</p>
        <p>These Stands get <em>User Stats, excluding Luck & Body</em> (Wit/Reason/Menacing/Pluck).</p>
        <p>The Pool given for these stats is (<em>Learning Ranks × 3</em>), to a maximum of 15 Points.</p>
        <p>A Stand can still have personality traits and instincts without being Independent.</p>
        <p><em>Examples: Cheap Trick, Paisley Park, Anubis, Wonder Of U.</em></p>
      `
			, stats: ["wit", "reason", "menacing", "pluck"]
		}
		, Act: {
			label: "Act Stand"
			, cost: "Minimum Learning B, Lower Point Pools"
			, description: `
        <p><em><u>Act 🎭</u></em></p>
        <p>Stands that have <em>alternative forms</em>, each with their own stats & related abilities.</p>
        <p>These Stands start at <strong>Act 1</strong>, gaining new <em>Acts</em> as the character develops.</p>
        <p>Once a new Act exists, the Stand can <em>slide</em> between them at will.</p>

        <p>Each Act burns 2 <em>Learning Ranks</em>, so a full <em>3-Act</em> Stand must manage its burns.</p>
        <p>Act 1 would have an <strong>A</strong> for temporary Learning burns, with Act 2 at C and Act 3 at E.</p>
        <p>Burning temporary ranks as one Act burns them for all Acts.</p>
        <p>For permanent burns, the latest Act is used.</p>

        <p>If it is a <em>2-Act</em> Stand, Acts 1 & 2 each have 3/4ths the base point pool, rounded down.</p>
        <p>For a <em>3-Act</em> Stand, each of the Acts has 2/3rds, rounded down.</p>
        <p>Learning & Ability are paid for after the deduction.</p>
        <p>Learning is priced at the new Act's grade, and can't be increased.</p>

        <p><em>Ex.</em> Act 1 has a B Learning and Act 2 burns to a D, both have [3P] Abilities, 21 base PB.</p>
        <p>At a pool of (21P * 3/4) = 15P, Act 1 has (15P - [4P (B Learning) + 3P (Ability)]) = 8P left.</p>
        <p>Act 2 has (15P - [2P (D Learning) + 3P (Ability)]) = 10P left.</p>

        <p>The PCs may <em>create</em> the Acts, but the Narrator usually decides their <em>activation</em>.</p>
        <p>Rule of thumb; Act 1 in Earlygame, Act 2 when starting Midgame, and Act 3 Lategame.</p>

        <p>Act 4 is rare, due to game-breaking potential.</p>
        <p>Act 4 gets 4/3rds of the normal Stand Pool, and only appear in the Endgame.</p>
        <p>Due to the lack of Learning, this Act must be achieved through <em>other means</em>.</p>

        <p><em>Examples: Echoes, Tusk.</em></p>
      `
		}
		, Other: {
			label: "Other Stand"
			, cost: "Variable"
			, description: `
        <p><em><u>Other 🔮</u></em></p>
        <p>Niche Types that often only apply to one or two Stands, or no prior precedent.</p>
        <p><em>Examples: Range-Irrelevant, Sub-Stands, Combined, Harmful, Shared, Posthumous, Room, Wounds, Beyonds, Requiem, Mass Hysterias, Homebrewed Types.</em></p>
      `
		}
	},

	power: {
		None: {
			label: ""
		, }
		, Hamon: {
			label: "Hamon Warrior"
      , image: "systems/bizarre-adventures-d6/assets/icons/powers/energy-breath.svg"
      , fields: [
        {
          name: "overdrive",
          label: "Overdrive",
          type: "textarea",
          placeholder: "e.g. Ripple Strike"
        }
      ]
			, statlabels: [
        "Strength (Power)"
        , "Accuracy (Precision)"
        , "Agility (Speed)"
        , "Conduction (Range)"
        , "Blocking (Durability)"
        , "Learning (Learning)"
      ]
			, description: `
        <p><em><u>Hamon Warrior ⟳</u></em></p>
        <p>An ancient <em>breathing technique</em>, Hamon is drawn from the User's vital energy.</p>
        <p>A Hamon User must maintain a consistent <em>rhythm</em> of breathing to use Hamon.</p>

        <p><em><u>Basic Abilities</u></em></p>
        <p>
          <u>Conduction</u> - Hamon travels very well through <em>liquids and organics</em>, like oil or flesh.
          Hamon can have <em>positive/negative</em> charges, to attract or repel in physics-defying ways.
          Users can also <em>infuse</em> objects with this life energy, acting like a charged battery.
          The effects of infusion depend on the User's <u>Overdrive</u> and <u>Range</u>.
          Hamon <em>disperses</em> over large areas; small points of contact are strongly <em>concentrated</em>.
        </p>

        <p>
          <u>Sunlight Sendo</u> (<em>-X Temp Learning</em>) - Hamon's original usage is tuning the User's breath to the frequency of <em>sunlight</em>, to counter Pillar Men and Vampires.
          Actions against the <em>undead</em> get <strong>+1 Advantage</strong> for each Learning rank burnt.
        </p>

        <p>
          <u>Hamon Healing</u> (<em>-X Temp</em>) - <u>Reduces Severity</u> of all physical Hits on the target.
          The reduction is equal to the Learning burnt. If a Hit is scaled down to 0, it is removed.
          As an <em>Action</em>, a Reaction can intervene.
        </p>

        <p>
          <u>Rhythmic Breathing</u> (<em>Other</em>) - <strong>Regain 1 Temp Learning/Round</strong> while breath is focused.
          Situations that <em>disrupt</em> the Hamon Warrior's flow will <strong>burn 1 Temp Learning/Round</strong>.
          Ranks decreasing to 0 cuts off <u>all</u> Hamon Abilities (including Stats) until restored.
        </p>

        <p><em><u>Special Ability - Overdrives</u></em></p>
        <p>
          <u>Overdrives</u> are unique <em>techniques</em> related in some way to <em>vibrations</em> or <em>wavelength</em>.
          This can range anywhere from sound waves, to water molecules, to string theory.
          Overdrives are the equivalent of a Stand Ability, as are all other 'Special Abilities'.
        </p>

        <p><em><u>Stats</u></em></p>
        <p>Stats are the <em>vigor</em> of a User's Hamon & Overdrive, applied directly to them.</p>
        <p><strong>Power</strong> = The potency of Hamon, User's <em>strength</em>.</p>
        <p><strong>Speed</strong> = The responsiveness of Hamon's effects, User's <em>agility</em>.</p>
        <p><strong>Precision</strong> = The exactness of Hamon's output variation, User's <em>control</em>.</p>
        <p><strong>Durability</strong> = The hardness given to infused objects, User's <em>defense</em>.</p>
        <p><strong>Range</strong> = The conduction of the Hamon, from flesh-only to steel bars to the intangible.</p>
        <p><strong>Learning</strong> = Lung capacity. Temporarily burnt when the Basic Abilities are used.</p>
      `
		}
		, Vampire: {
			label: "Vampire"
      , image: "systems/bizarre-adventures-d6/assets/icons/powers/cracked-mask.svg"
			, statlabels: [
        "Strength (Power)"
        , "Senses (Precision)"
        , "Reflex (Speed)"
        , "Bodily Control (Range)"
        , "Resilience (Durability)"
        , "Learning (Learning)"
      ]
			, description: `
        <p><em><u>Vampire 🦇</u></em></p>
        <p>A former human who came in contact with a <em>Stone Mask</em>, and rejected their humanity.</p>
        <p>Through <em>brain acupuncture</em>, these people have unlocked their <em>inner potential</em>.</p>

        <p><em><u>Basic Abilities</u></em></p>
        <p>
          <u>Inhuman Body</u> - Vampiric minds are enhanced to allow extreme <em>self-manipulation</em>.
          The versatility of this ability depends on the bodily systems added via the <em>Range</em> rank.
          Common uses include <em>vein control</em>, <em>Space Ripper Stingy Eyes</em>, and <em>reattaching limbs</em>.
        </p>
        <p>
          Vampires <strong>cannot</strong> be Retired, still acting at <strong>0</strong> and <strong>-1 Hit Limit</strong>.
          Vampires <strong>can</strong> still die from normal injuries if the death threshold of <strong>-2</strong> is reached.
          Hamon and Sunlight contact will instantly kill at <strong>0 Hit Limit</strong>, sunlight is a <strong>Severity 9 Hit</strong>.
          Hamon/Sun Hits are <em>permanent</em> until healed with <em>massive amounts of blood</em>.
        </p>

        <p>
          <u>Blood Sucking</u> (<em>+1/2/3 Temp</em>) - Inject veins into a victim, gaining <em>vampiric essence</em>.
          This is the <strong>only</strong> way Vampires regain Temp Learning; it does not reset automatically.
          Ranks gained depend on the level of harm: 1 = Injury, 2 = Lethal, 3 = Mass Casualty.
        </p>

        <p>
          <u>Regeneration</u> (<em>-2 Temp</em>) - Fully remove a non-Hamon/Sun Hit, as an <em>Action</em>.
        </p>

        <p>
          <u>Zombification</u> (<em>-X Temp</em>) - Vampires can turn a Retired lifeform into a <em>Zombie</em>.
          A Zombie only has <em>Inhuman Body</em> and a <em>Function</em>; it has <strong>no Learning</strong>.
          Zombies have a Point Pool equal to (<em>Ranks Burnt × 4</em>).
          A Flesh Bud can be made instead to preserve a Stand, but can be excised.
          Stands then have their stats reduced to (<em>Ranks Burnt / 5</em>) of their original pool.
        </p>

        <p><em><u>Special Ability - Functions</u></em></p>
        <p>
          <u>Functions</u> are a <em>superhuman bodily process</em>, deforming <em>natural biology</em> for gimmicks.
          Ex: Dio's <em>Vapor Freezing Technique</em>, Nukesaku's <em>Dual Faces</em>, Wired Beck's <em>Body Hair</em>.
        </p>

        <p><em><u>Stats</u></em></p>
        <p>The enhanced flesh of the Vampire. Stats apply directly to themselves, as with Hamon.</p>
        <p><strong>Power</strong> = The strength of the vampire.</p>
        <p><strong>Speed</strong> = The reflexes of the vampire.</p>
        <p><strong>Durability</strong> = The resilience of the vampire.</p>
        <p><strong>Precision</strong> = The senses of the vampire.</p>
        <p><strong>Range</strong> = The bodily control of the vampire; number of systems in voluntary command.</p>
        <p><strong>Learning</strong> = Vampiric essence.</p>
      `
		}
		, Spin: {
			label: "Spin"
      , image: "systems/bizarre-adventures-d6/assets/icons/powers/ink-swirl.svg"
			, statlabels: [
        "Mass (Power)"
        , "Manuverability (Precision)"
        , "Velocity (Speed)"
        , "Inertia (Range)"
        , "Sturdiness (Durability)"
        , "Vision (Learning)"
      ]
			, description: `
        <p><em><u>Spin Master 🌀</u></em></p>
        <p>Spin is drawn from the User's <em>life energy</em> as a battery, much like Hamon.</p>
        <p>However, <em>certain objects</em> infused with Spin can <em>maintain the charge indefinitely</em>.</p>
        <p>Unlike Hamon's vibration and wavelength, Spin controls <em>rotation</em> and <em>kinetic energy</em>.</p>

        <p><em><u>Special Ability - Devices</u></em></p>
        <p>
          <u>Devices</u> are the tool that the Spin Master relies on, without any Learning costs.
          Devices are specifically <em>tailored</em> to certain uses of the spin to create an <em>Effect</em>.
        </p>
        <p>
          The Device's <em>Effect</em> is an Ability based on <em>physics</em> or <em>pseudoscience</em>.
          The canon example of a Device's Effect is Wrecking Ball's <em>Sinistral Ataxia</em>.
        </p>

        <p><em><u>Basic Abilities</u></em></p>
        <p>
          <u>Rotation</u> (<em>-1 Temp</em>) - Infusing Spin into non-Device, improvised mediums.
          Stats besides Learning <em>differ</em> depending on the medium's properties.
          Devices the User didn't make can be used, if they know how it works (cost still applies).
        </p>
        <p>
          <u>Kinetic Displacement</u> (<em>-1 Temp</em>) - Shifts kinetic force from one area to another.
          For example, punch a wall to hit the person <em>behind</em> it, or <em>shift</em> an injury's location.
        </p>
        <p>
          <u>Golden Spin</u> (<em>-X Temp</em>) - Devices harness a <em>mathematical truth</em>, hidden in nature.
          If a <em>replication</em> of it is found, boost a non-Learning Stat equal to ranks burnt, up to <strong>A</strong>.
          This boost lasts until the Device's energy or the focus being used are <em>interrupted</em>.
        </p>
        <p>
          <u>Super Spin</u> (<em>-X/1 Perm, min. 1</em>) - The perfected form of that Device's Golden Spin.
          It is a unique, complicated technique that allows the device to tap into infinity.
          A discounted Permanent burn is made, but it is <em>only</em> usable during Super Spin.
          If used multiple times, a different Super Spin technique must be used for each variant.
        </p>

        <p><em><u>Stats</u></em></p>
        <p>Stats (except Learning) are tied to the Device or improvised medium, not the User.</p>
        <p><strong>Power</strong> = The Device's mass and destructiveness.</p>
        <p><strong>Speed</strong> = The Device's travel time and velocity.</p>
        <p><strong>Durability</strong> = The Device's sturdiness and level of craftsmanship.</p>
        <p><strong>Precision</strong> = The Device's maneuverability and control.</p>
        <p><strong>Range</strong> = The Device's inertia and ability to maintain Spin in unfavorable conditions.</p>
        <p><strong>Learning</strong> = Vision. Both temporarily and permanently burnt.</p>
      `
		}
		, Armed: {
			label: "Armed Phenomenon"
      , image: "systems/bizarre-adventures-d6/assets/icons/powers/tadpole.svg"
			, statlabels: [
        "Strength (Power)"
        , "Accuracy (Precision)"
        , "Agility (Speed)"
        , "Evolution (Range)"
        , "Endurance (Durability)"
        , "Learning (Learning)"
      ]
			, description: `
        <p><em><u>Armed Phenomenon ⚙</u></em></p>
        <p>A lifeform infected with a <em>Parasite</em>, gaining power in exchange for a <em>doomed future</em>.</p>

        <p><em><u>Basic Abilities</u></em></p>
        <p>
          <u>Sentient Parasite</u> (<em>-1 Temp</em>) - More than just a weapon, they have a mind of their own.
          The Parasite gains User Stats (excluding <em>Luck</em>) with a pool of (<em>Range Ranks × 3</em>).
          A host can use the Parasite's <em>Stats</em> without Learning burn, but loses control doing so.
        </p>
        <p>
          <u>Instant Regeneration</u> (<em>-3 Temp</em>) - One physical Hit is <em>instantly healed</em>, not an <em>Action</em>.
          Armed Phenomenon still Retire at <strong>0</strong>, but can <em>only</em> die by fire or Hamon, and only at <strong>-2</strong>.
          Parasite death or extraction will kill the Host as well, without exception.
        </p>

        <p><em><u>Special Ability - Phenomena</u></em></p>
        <p>
          A <u>Phenomenon</u> is similar to a vampiric <em>Function</em>, biologically based powers.
          Each Phenomenon is added at a specific <em>Stage</em>, which advances with time or plot.
          All Phenomena/Properties are <em>bought in advance at half cost</em> during character creation.
          If the sum is odd, round up for the final cost (ex. 2 + 3 + 6 = 11, 11/2 = 5.5 → 6 Points).
        </p>

        <p><u>Stage 1</u> - The Parasite <em>awakens</em>. The Host <em>unlocks</em> Phenomenon #1, but appears normal.</p>
        <p><u>Stage 2</u> - The Parasite <em>matures</em>. Phenomenon #2 is added, and a <em>Morph</em> form is made.
          This transformation improves the Host's body and stats, but also <em>possesses</em> them.
          A condition is needed to <em>trigger</em> the Morph, to use all post-Stage 1 Phenomena/Stats.
          The canon example of a <em>Morph Property</em> is Ikuro's Armored Body.
        </p>
        <p><u>Stage 3</u> - The Parasite & Host <em>merge</em>. The Morph is now <em>permanent</em>, no on/off switch.
          Phenomenon #3 emerges. The Host is <em>synchronized</em> and <em>Sentient Parasite</em> has no cost.
        </p>
        <p><u>Stage 4</u> - The Parasite is at <em>critical level</em>. It will soon reproduce, and the Host will die.
          What happens during this depends on the Parasite's species, and is <em>unknown</em>.
        </p>

        <p><em><u>Stats</u></em></p>
        <p>The enhanced form of the Host. The first four stats are only accessible when <em>morphed</em>.</p>
        <p><strong>Power</strong> = The Host's strength when transformed.</p>
        <p><strong>Speed</strong> = The Host's agility when transformed.</p>
        <p><strong>Durability</strong> = The Host's endurance when transformed.</p>
        <p><strong>Precision</strong> = The Host's accuracy when transformed.</p>
        <p><strong>Range</strong> = The parasite's evolution. Used for their point buy.</p>
        <p><strong>Learning</strong> = The parasite's <em>adaptability</em>. Burnt for instant regeneration and adaptation.</p>
      `
		}
		, Cyborg: {
			label: "Cyborg"
      , image: "systems/bizarre-adventures-d6/assets/icons/powers/cyborg-face.svg"
        , fields: [
          {
            name: "Upgrades",
            label: "Upgrade Description",
            type: "textarea"
          }
        ]
			, statlabels: [
        "Tech Power (Power)"
        , "Precision (Precision)"
        , "Speed (Speed)"
        , "Range (Range)"
        , "Durability (Durability)"
        , "Learning (Learning)"
      ]
			, description: `
      <p><em><u>Cyborg 🤖</u></em></p>
      <p>A <em>mechanized being</em>, surpassing their limits with the <em>power of science</em>.</p>

      <p><em><u>Special Ability - Upgrades</u></em></p>
      <p>
        An <u>Upgrade</u> is an enhancement, adding a tool or property to the Cyborg frame.
      </p>
      <p>
        A Cyborg starts with <em>two Initial Upgrades</em>, each worth up to <strong>3 Points</strong>.
        Cyborgs can have up to <strong>five total Upgrades</strong>, including <em>Experiments</em>.
      </p>
      <p>
        When a Cyborg is <em>Retired</em>, one Upgrade of their choice is <em>permanently broken</em>.<br>
        When a Cyborg dies, all Upgrades <strong>except one</strong> will break.
      </p>

      <p><em><u>Basic Abilities</u></em></p>
      <p>
        <u>Experiment</u> (<em>-3 Temp</em>) - Permanently adds a new Upgrade to the Cyborg's arsenal.
        The maximum extent of an Experiment is decided by the Cyborg's <em>Range</em>.
      </p>
      <p>
        <u>Tweak</u> (<em>-2 Temp</em>) - Modify an existing Upgrade, increasing its point value by <strong>+1</strong>.
        Tweaks can be burnt twice at once to increase point value by <strong>+2</strong>.
        Any given Upgrade can have a maximum point value of <strong>3</strong>.
        If an Upgrade is already at 3 points, Tweak can modify it into a different 3-point ability.
      </p>
      <p>
        <u>Rebuild</u> (<em>-X Perm</em>) - When a Cyborg dies, they can be restored better than ever.
        For each <em>permanent rank</em> spent, add <strong>one Experiment or two Tweaks</strong>.
        For each rank spent <em>past the first</em>, gain <strong>one point</strong> to increase a non-Learning Stat.
      </p>

      <p><em><u>Stats</u></em></p>
      <p>The improved <em>prowess</em> of the Cyborg. Applied directly to the User's mechanical body.</p>
      <p><strong>Power</strong> = The strength of the Cyborg frame.</p>
      <p><strong>Speed</strong> = The responsiveness of the Cyborg frame.</p>
      <p><strong>Durability</strong> = The reinforcement of the Cyborg frame.</p>
      <p><strong>Precision</strong> = The Cyborg frame's accuracy and senses.</p>
      <p><strong>Range</strong> = How advanced the Cyborg's Experiments are.</p>
      <p><strong>Learning</strong> = Resources. How quickly a Cyborg can surpass their limits.</p>
    `
		}
		, Other: {
			label: "Other Power"
			, statlabels: [
        "Power (Power)"
        , "Precision (Precision)"
        , "Speed (Speed)"
        , "Range (Range)"
        , "Durability (Durability)"
        , "Learning (Learning)"
      ]
		}

	}
};

BAD6.typeConfigs = typeConfigs;


