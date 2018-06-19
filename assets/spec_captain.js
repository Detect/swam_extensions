!function() {
	const extensionConfig = {
		name: 'Spec Captain for CTF',
		id: 'SpecCaptain',
		description: 'Keybinds for better spectating.',
		author: 'Detect',
		version: '0.2'
	};

	const KEY_CODES = {
		TOGGLE_FLAGS: 81, //q
		TOGGLE_BASES: 87, //w
		TOGGLE_PLAYERS: 69, //e
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

				const $playerNameWithFlag = (TOGGLE_IDS.FLAGS === TEAMS.BLUE) ? $('#blueflag-name') : $('#redflag-name');
				const playerNameWithFlag = $playerNameWithFlag.text().trim().replace(/[0-3]\/[0-3]/g, '');

				// console.log("playerNameWithFlag", playerNameWithFlag);

				if(playerNameWithFlag !== '') {
					setTimeout(() => SWAM.setTargetedPlayer(Players.getByName(playerNameWithFlag).id), 250);
				} else {
					[x, y] = (TOGGLE_IDS.FLAGS === TEAMS.BLUE) ? COORDINATES.FLAGS.BLUE : COORDINATES.FLAGS.RED;

					// console.log(x,y);
					setCamera(x, y);
				}

				break;
			case KEY_CODES.TOGGLE_BASES:
				console.log('bases');

				if(shouldToggle) {
					TOGGLE_IDS.BASES = (TOGGLE_IDS.BASES === TEAMS.BLUE) ? TEAMS.RED : TEAMS.BLUE;
				}

				[x, y] = (TOGGLE_IDS.BASES === TEAMS.BLUE) ? COORDINATES.BASES.BLUE : COORDINATES.BASES.RED;

				setCamera(x, y);
				break;
			case KEY_CODES.TOGGLE_PLAYERS:
				console.log('players');
				// SWAM.setTargetedPlayer(playerId)
				break;
		}

		lastKeyCode = event.keyCode;
	}

	bindCTFFlag = (data) => {
		if(data.type !== 1) return;

		if(data.flag === TEAMS.BLUE) {
			COORDINATES.FLAGS.BLUE = [data.posX, data.posY];
		} else if(data.flag === TEAMS.RED) {
			COORDINATES.FLAGS.RED = [data.posX, data.posY];
		};
	}

	setCamera = (x, y) => {
		setFreeCamera();
		setTimeout(() => { Graphics.setCamera(x, y); }, 250);
	}

	setFreeCamera = () => {
		SWAM.setTargetedPlayer(game.myID);
	}

	// Event handlers
	SWAM.on('keyup', bindKeyUp);
	SWAM.on('CTF_Flag', bindCTFFlag);

	// Register mod
	SWAM.registerExtension(extensionConfig);
}();
