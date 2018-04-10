!function() {
	const extensionConfig = {
		name: 'Spec Captain for CTF',
		id: 'SpecCaptain',
		description: 'Keybinds for better spectating.',
		author: 'Detect',
		version: '0.1'
	};

	const KEY_CODES = {
		TOGGLE_FLAGS: 49,
		TOGGLE_BASES: 50,
		TOGGLE_PLAYERS: 51,
	};

	const TEAMS = {
		BLUE: 1,
		RED: 2
	};

	const TOGGLE_IDS = {
		FLAGS: TEAMS.BLUE,
		BASES: TEAMS.BLUE,
		PLAYERS: 0,
	};

	const COORDINATES = {
		BASES: {
			BLUE: [-9385, -1560],
			RED: [8260, -1055],
		},
		FLAGS: {
			BLUE: [0, 0],
			RED: [0, 0],
		}
	};

	let lastKeyCode = null;

	// Functions
	bindKeyUp = (event) => {
		const isSpectating = Players.getMe().removedFromMap;

		if(!isSpectating) return;

		const shouldToggle = (lastKeyCode === event.keyCode);
		let x, y;

		switch(event.keyCode) {
			case KEY_CODES.TOGGLE_FLAGS:
				console.log('flags');

				if(shouldToggle) {
					TOGGLE_IDS.FLAGS = (TOGGLE_IDS.FLAGS === TEAMS.BLUE) ? TEAMS.RED : TEAMS.BLUE;
				}

				[x, y] = (TOGGLE_IDS.FLAGS === TEAMS.BLUE) ? COORDINATES.FLAGS.BLUE : COORDINATES.FLAGS.RED;

				Graphics.setCamera(x, y);
				break;
			case KEY_CODES.TOGGLE_BASES:
				console.log('bases');

				if(shouldToggle) {
					TOGGLE_IDS.BASES = (TOGGLE_IDS.BASES === TEAMS.BLUE) ? TEAMS.RED : TEAMS.BLUE;
				}

				[x, y] = (TOGGLE_IDS.BASES === TEAMS.BLUE) ? COORDINATES.BASES.BLUE : COORDINATES.BASES.RED;

				Graphics.setCamera(x, y);
				break;
			case KEY_CODES.TOGGLE_PLAYERS:
				console.log('players');
				// SWAM.setTargetedPlayer(playerId)
				break;
		}

		lastKeyCode = event.keyCode;
	}

	// Event handlers
	SWAM.on('keyup', bindKeyUp);

	// Register mod
	SWAM.registerExtension(extensionConfig);
}();
