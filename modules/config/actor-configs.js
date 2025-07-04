// systems/bizarre-adventures-d6/scripts/sheets/type-configs.js

export const typeConfigs = {
  user: {
    Natural: {
      label: "Natural User",
      cost: "None",
      description: "A Natural-born stand user, drawn by fate for a mysterious purpose."
    },
    Freak: {
      label: "Freak",
      cost: "1-3 User Points",
      description: `
        • Someone with anomalous powers that defy explanation, not tied to a Power Source.
        • Traits that are just strange do not need to be paid for, they can be included in a Bio.
        • Ex. Bruford's Danse Macab-Hair, Mrs. Robinson's bugs, Diavolo's dual souls.
      `
    },
    Ghost: {
      label: "Ghost",
      cost: "2 User Points",
      description: `
        • A spirit of the dead, tied to the mortal world by an unfulfilled purpose.
        • They typically keep whatever injury caused their death as a Mark.
        • Ghosts must follow certain Rules.
        - Ghosts are on the same level of selective intangibility as Stands.
        - Animals and Stand Users can see Ghosts.
        - Ghosts cannot be seen by normal people, but can make themselves heard.
        - If a Ghost's limb unwillingly touches a living thing, it is severed but not lost.
        - Normal objects may be manipulated as normal, but not felt by the ghost.
        - When any object is destroyed, its previous form becomes a Ghost Object.
        - Ghost Objects can be used by Ghosts, and only affect other non-living spirits.
        - Ghosts may only enter a room if let inside, or it is empty.
      `
    },
    Alien: {
      label: "Alien",
      cost: "2 User Points",
      description: `
        • A shapeshifting extraterrestrial, hailing from the Magellanic Clouds and lost on Earth.
        -
        • These beings can Shapeshift into any non-complex object, of equal or lesser mass.
        • Aliens have a Sensitivity to high-pitched sounds, and take a Hit on exposure.
        • While exposed to sound, the alien's form will be unstable, and change rapidly.
        -
        • Aliens may also have access to foreign technologies and weapons based on setting.
        • This section is made under the assumption that Mikitaka is not a Stand User.
      `,
      fields: [
        {
          key:         "abilities",
          label:       "Abilities",
          rows:        3,
          description: `
            • A shapeshifting extraterrestrial, hailing from the Magellanic Clouds and lost on Earth.
            -
            • These beings can Shapeshift into any non-complex object, of equal or lesser mass.
            • Aliens have a Sensitivity to high-pitched sounds, and take a Hit on exposure.
            • While exposed to sound, the alien's form will be unstable, and change rapidly.
            -
            • Aliens may also have access to foreign technologies and weapons based on setting.
            • This section is made under the assumption that Mikitaka is not a Stand User.
          `
        }
      ]
    },
    Rock: {
      label: "Rock Human",
      cost: "1 User Point",
      description: `
        A counterpart to Homo Sapiens, in tune with nature and attracted to ‘sacred ground’.
        Rock Form is used for months-long hibernation, resisting extreme conditions.
        After hibernating, the Rock Human can stay awake for an equal amount of time.

        They all have a mango allergy, and despite being Silicon-based can eat a paleo diet.
        Due to their Incubation, they lack legal identities, prosocial emotions, and childhoods.
        
        All Rock Organisms can turn parts of their body into a chosen Material.
        Rock Animals/Insects are known to Masquerade as human-made objects.
        Rock Humans are more sophisticated at this, opting for identity theft and fake jobs.
      `,
      fields: [
        {
          key:         "abilities",
          label:       "Abilities",
          rows:        3,
          description: `
            A counterpart to Homo Sapiens, in tune with nature and attracted to ‘sacred ground’.
            Rock Form is used for months-long hibernation, resisting extreme conditions.
            After hibernating, the Rock Human can stay awake for an equal amount of time.

            They all have a mango allergy, and despite being Silicon-based can eat a paleo diet.
            Due to their Incubation, they lack legal identities, prosocial emotions, and childhoods.
            
            All Rock Organisms can turn parts of their body into a chosen Material.
            Rock Animals/Insects are known to Masquerade as human-made objects.
            Rock Humans are more sophisticated at this, opting for identity theft and fake jobs.
          `
        }
      ]
    },
    Pillar: {
      label: "Pillar Man",
      cost: "4 User/4 Stand, Vampire, GM Approval",
      description: `
        • A mesoamerican ultra-vampire, horned apex predators from a bygone era.
        -
        • Higher Being grants double the organ systems from Range ranks, and superior minds.
        • The first User Stat roll has double dice, A Power B/Wit A roll would be 14d6 in total.
        • A Pillar Man that hasn't used a Stone Mask still ages, but lives for thousands of years.
        • Rock Form can negate instant death from Hamon/Sun exposure, and help hibernate.
        -
        • After using a Stone Mask, a Pillar Man's innate vampirism and hunger increase greatly.
        • Superhuman Body lets Pillar Men rearrange their bodies or others at will.
        • Absorption upgrades Blood Sucking, assimilating live victims on any physical contact.
        • Functions evolve into Modes based on an element.
        • Vampirification - Creates Vampires with Learning, all Abilities, and (Ranks * 5) Points.
      `,
      fields: [
        {
          key:         "abilities",
          label:       "Abilities",
          input:       "textarea",
          rows:        3,
          placeholder: "Summary of anomalous powers",
          description: `
            • A mesoamerican ultra-vampire, horned apex predators from a bygone era.
            -
            • Higher Being grants double the organ systems from Range ranks, and superior minds.
            • The first User Stat roll has double dice, A Power B/Wit A roll would be 14d6 in total.
            • A Pillar Man that hasn't used a Stone Mask still ages, but lives for thousands of years.
            • Rock Form can negate instant death from Hamon/Sun exposure, and help hibernate.
            -
            • After using a Stone Mask, a Pillar Man's innate vampirism and hunger increase greatly.
            • Superhuman Body lets Pillar Men rearrange their bodies or others at will.
            • Absorption upgrades Blood Sucking, assimilating live victims on any physical contact.
            • Functions evolve into Modes based on an element.
            • Vampirification - Creates Vampires with Learning, all Abilities, and (Ranks * 5) Points.
          `
        }
      ]
    },
    // …other user types…
  },

  stand: {
    Natural: {
      label: "Natural Stand",
      cost: "None",
      description: `
        A standard Stand type, with a majorly human or animal physiology with limbs.
        Examples: Star Platinum, Hierophant Green, Grateful Dead, Clash.
      `
    },
    Artificial: {
      label: "Artificial Stand",
      cost: "None",
      description: `
        As opposed to Natural, these Stands have a more abstract or mechanical body.
        Examples: Hermit Purple, Ratt, Aerosmith, Manhattan Transfer.
      `
    },
    Object: {
      label: "Object Stand",
      cost: "None",
      description: `
        Tools with the Ability tied to them, which can be summoned & withdrawn at will.
        These Stands are known to survive past even the User’s death.
        Examples: Emperor, Thoth, Cream Starter, Beach Boy.
      `
    },
    Bound: {
      label: "Bound Stand",
      cost: "None",
      description: `
        A Stand Ability that assimilates itself into another physical, tangible thing at will.
        Non-users can interact with it, as it’s not a pure Stand-type manifestation.
        The enhanced substance is generally manipulable, & cannot be withdrawn.
        Examples: The Fool, Super Fly, Strength, Les Feuilles.
      `
    },
    Wearable: {
      label: "Wearable Stand",
      cost: "None",
      description: `
        Stands worn by the User, often as a suit or accessory.
        These Stands, as with Object Stands, are usually immobile.
        Others can wear the Stand, though Range restricts distance from the User.
        Examples: Oasis, White Album, Catch The Rainbow, Mandom.
      `
    },
    Swarm: {
      label: "Swarm Stand",
      cost: "None",
      description: `
        Swarm Stands are a conglomerate of units, operated by the User at once.
        Power & Durability stats are for the swarm as a whole, partial groups have lower stats.
        Single-unit death does not harm the User, only substantial amounts of lost units do.
        Examples: Harvest, Bad Company, Pearl Jam, Metallica, Sex Pistols.
      `
    },
    Integrated: {
      label: "Integrated Stand",
      cost: "None",
      description: `
        These Stands have no or minimal manifestation.
        Integrated Abilities are applied to the User directly, without a punchghost.
        Durability & Range are often of lesser use without a Stand body.
        Examples: Khnum, Stray Cat, Mr. President, Tatoo You!, Oh! Lonesome Me.
      `
    },
    Automatic: {
      label: "Automatic Stand",
      cost: "None",
      description: `
        Stands with simple AI-style behavior, instead of having the User in direct command.
        The manifestation itself typically has no range leash.
        Range still applies to the Ability, relative to the target’s distance from the Stand.
        Precision is often of lesser use, as Automatics choose targets based on a condition.
        Examples: Black Sabbath, Marilyn Manson, Born This Way.
      `
    },
    Detached: {
      label: "Detached Stand",
      cost: "None",
      description: `
        Stands that do not synchronize senses or injuries with their User.
        Most Detached Automatic and Object Stands can respawn when destroyed.
        Most Detached Bound Stands can rebind to their medium of choice when damaged.
        Detached Stands of other types are vulnerable to a Stand Break, which counts as a Hit.
        While a Stand is Broken, its manifestation and ability are unusable.
        Examples: Highway Star, Sheer Heart Attack, Baby Face.
      `
    },
    Indepdendent: {
      label: "Independent Stand",
      cost: "None",
      description: `
        Stands capable of sentient thought & action, having a mind of their own.
        These Stands get User Stats, excluding Luck & Body. (Wit/Reason/Menacing/Pluck)
        The Pool given for these stats is (Learning Ranks * 3), to a maximum of 15 Points.
        A Stand can still have personality traits and instincts without being Independent.
        Examples: Cheap Trick, Paisley Park, Anubis, Wonder Of U.
      `
    },
    Act: {
      label: "Act Stand",
      cost: "None",
      description: `
        Stands that have alternative forms, each with their own stats & related abilities.
        These Stands start at Act 1, gaining new Acts as the character develops.
        Once a new Act exists, the Stand can slide between them at will.

        Each Act burns 2 Learning Ranks, so a full 3-Act Stand must manage its burns.
        Act 1 would have an A for temporary Learning burns, with Act 2 at C and Act 3 at E.
        Burning temporary ranks as one Act burns them for all Acts.
        For permanent burns, the latest Act is used.

        If it is a 2-Act Stand, Acts 1 & 2 each have 3/4ths the base point pool, rounded down.
        For a 3-Act Stand, each of the Acts has 2/3rds, rounded down.
        Learning & Ability are paid for after the deduction.
        Learning is priced at the new Act’s grade, and can’t be increased.

        Ex. Act 1 has a B Learning and Act 2 burns to a D, both have [3P] Abilities, 21 base PB.
        At a pool of (21P * 3/4) = 15P, Act 1 has (15P - [4P (B Learning) + 3P (Ability)] = 8P left.
        Act 2 has (15P - [2P (D Learning) + 3P (Ability)] = 10P left.

        The PCs may create the Acts, but the Narrator usually decides their activation.
        Rule of thumb; Act 1 in Earlygame, Act 2 when starting Midgame, and Act 3 Lategame.

        Act 4 is rare, due to game-breaking potential.
        Act 4s get 4/3rds of the normal Stand Pool, and only appear in the Endgame.
        Due to the lack of Learning, this Act must be achieved through other means.

        Examples: Echoes, Tusk.
      `
    },
    Other: {
      label: "Other Stand",
      cost: "None",
      description: `
        Niche Types that often only apply to one or two Stands, or no prior precedent.
        Examples: Range-Irrelevant, Sub-Stands, Combined, Harmful, Shared, Posthumous,
        Room, Wounds, Beyonds, Requiem, Mass Hysterias, Homebrewed Types.
      `
    }
  },

  power: {
    Hamon: {
      label: "Hamon Warrior",
      fields: [
        {
          key:         "abilities",
          label:       "Abilities",
          input:       "textarea",
          rows:        2,
          placeholder: "Describe your power",
          description: "Incomplete."
        }
      ]
    },
    Vampire: {
      label: "Vampire",
      fields: [
        {
          key:         "abilities",
          label:       "Abilities",
          input:       "textarea",
          rows:        2,
          placeholder: "How it was created",
          description: "Details on how this power was artificially created."
        }
      ]
    },
    Spin: {
      label: "Spin",
      fields: [
        {
          key:         "abilities",
          label:       "abilities",
          input:       "textarea",
          rows:        2,
          placeholder: "How it was created",
          description: "Details on how this power was artificially created."
        }
      ]
    },
    Armed: {
      label: "Armed Phenomenon",
      fields: [
        {
          key:         "abilities",
          label:       "abilities",
          input:       "textarea",
          rows:        2,
          placeholder: "How it was created",
          description: "Details on how this power was artificially created."
        }
      ]
    },
    Cyborg: {
      label: "Cyborg",
      fields: [
        {
          key:         "abilities",
          label:       "abilities",
          input:       "textarea",
          rows:        2,
          placeholder: "How it was created",
          description: "Details on how this power was artificially created."
        }
      ]
    },
    // …other power types…
  }
};


/*
    const statLabels = {
      Hamon: ['Strength', 'Accuracy', 'Agility', 'Conduction', 'Blocking', 'Learning'],
      Vampire: ['Strength', 'Senses', 'Reflex', 'Bodily Control', 'Resilience', 'Learning'],
      'Pillar Man': ['Strength', 'Senses', 'Reflexes', 'Bodily Control', 'Resilience', 'Learning'],
      Spin: ['Mass', 'Control', 'Velocity', 'RPM', 'Sturdiness', 'Learning'],
      'Armed Phenomenon': ['Strength', 'Accuracy', 'Agility', 'Evolution', 'Endurance', 'Learning'],
      Cyborg: ['Tech Power', 'Precision', 'Speed', 'Range', 'Durability', 'Learning'],
      Other: ['Power', 'Precision', 'Speed', 'Range', 'Durability', 'Learning']
    };
*/