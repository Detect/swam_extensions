/*

Thanks to Nuppet for original shield timer UI and idea. https://pastebin.com/01Z6bb4n

*/

!function() {
	// Settings
	const DEFAULT_SETTINGS = {
		isTeamChatEnabled: true,
		teamChatUpdateIntervals: '60,30,10'
	};

	var userSettings = DEFAULT_SETTINGS;

	settingsProvider = () => {
		validate = (settings) => {
			if(typeof(settings.teamChatUpdateIntervals) === 'string') {
				// Turn CSV string into array of integers
				settings.teamChatUpdateIntervals = settings.teamChatUpdateIntervals.split(',').map(seconds => parseInt(seconds.trim()));
			}

			return settings;
		}

		onApply = (settings) => userSettings = validate(settings);

		let sp = new SettingsProvider(DEFAULT_SETTINGS, onApply);
		let section = sp.addSection('Shield Timer');
		section.addBoolean('isTeamChatEnabled', 'Automatically send shield timer to team chat');
		section.addString('teamChatUpdateIntervals', 'Intervals (seconds) to send team chat (comma separated)', {
			css: {
				width: '120px'
			}
		});

		return sp;
	};

	const extensionConfig = {
		name: 'Shield Timer for CTF',
		id: 'ShieldTimer',
		description: 'Adds enemy base shield spawn timer to UI and chat.',
		author: 'Detect',
		version: '0.5',
		settingsProvider: settingsProvider()
	};

	const MESSAGES = {
		RESUMED: 'Resumed sending shield timer',
		SPAWNING: 'Enemy shield spawning!',
		STARTED: 'Started enemy shield timer',
		PAUSED: 'Paused sending shield timer',
		UPDATED: (secondsLeft) => `${secondsLeft} seconds till enemy shield`
	};

	const TEAMS = {
		BLUE: 1,
		RED: 2
	};

	const SHIELD = {
		BASE_SPAWN_COORDINATES: {
			BLUE: {
				topLeft: {
					x: -9385,
					y: -1560
				},
				bottomRight: {
					x: -9200,
					y: -1400
				}
			},
			RED: {
				topLeft: {
					x: 8260,
					y: -1055
				},
				bottomRight: {
					x: 8440,
					y: -860
				}
			}
		},
		KEY_CODE: 66, // 'b'
		MOB_TYPE: 8,
		SPAWN_SECONDS: 105 - 3, // three second delay
	};

	class ShieldKeyboard {
		constructor() {
			this.bindListener();
		}

		bindListener() {
			SWAM.on('keyup', this.bindKeyUp);
		}

		bindKeyUp(event) {
			const keyPressed = (event.keyCode === SHIELD.KEY_CODE);

			if(!keyPressed) return;

			if(userSettings.isTeamChatEnabled) {
				// Toggle sending timer to team chat
				SWAM.trigger('shieldTimerToggleTeamChat');
			} else {
				// Send current timer to team chat
				SWAM.trigger('shieldTimerSendTeamChat');
			}
		}
	}

	class ShieldTeamChat {
		constructor() {
			this.bindListeners();
		}

		bindListeners() {
			SWAM.on('shieldTimer', this.updateChat.bind(this));
			SWAM.on('shieldTimerToggleTeamChat', this.toggle.bind(this));
			SWAM.on('shieldTimerSendTeamChat', this.send.bind(this));
		}

		send() {
			const message = MESSAGES.UPDATED(this.secondsLeft);

			if(!!this.secondsLeft) Network.sendTeam(message);
		}

		toggle() {
			const canToggle = userSettings.isTeamChatEnabled;

			if(!canToggle) return;

			const message = this.paused ? MESSAGES.RESUMED : MESSAGES.PAUSED;

			Network.sendTeam(message);

			this.paused = !this.paused;
		}

		updateChat(secondsLeft) {
			this.secondsLeft = secondsLeft;

			const shouldUpdate = (secondsLeft !== false && !this.paused);

			if(!shouldUpdate) return;

			var message;
			const isTimerStarted = secondsLeft === SHIELD.SPAWN_SECONDS;
			const isTimerStopped = secondsLeft === 0;
			const shouldSendChatUpdate = userSettings.teamChatUpdateIntervals.includes(parseInt(secondsLeft));

			if(isTimerStarted) {
				message = MESSAGES.STARTED;
			} else if(shouldSendChatUpdate) {
				message = MESSAGES.UPDATED(secondsLeft);
			} else if(isTimerStopped) {
				message = MESSAGES.SPAWNING;
			}

			const shouldSendChat = !!message && userSettings.isTeamChatEnabled;

			if(shouldSendChat) Network.sendTeam(message);
		}
	}

	class ShieldUI {
		constructor() {
			this.createShieldInfo();
			this.bindListener();
		}

		bindListener() {
			SWAM.off('shieldTimer', this.setValue);
			SWAM.on('shieldTimer', this.setValue.bind(this));
		}

		createShieldInfo() {
			const shieldInfoExists = !!$('#shieldInfo').length;

			if(shieldInfoExists) return false;

			const $shieldInfo = $(`
				<div id='shieldInfo' style='
					background-image: url(//detect.github.io/swam_extensions/assets/shield.png);
					background-repeat: no-repeat;
					background-size: contain;
					display: none;
					font-weight: 700;
					height: 30px;
					left: 43%;
					line-height: 30px;
					padding-left: 40px;
					position: absolute;
					top: 40px;
					width: 30px;
				'></div>
			`);

			$('#gamespecific').append($shieldInfo);
		}

		hide() {
			$('#shieldInfo').hide();
		}

		show() {
			$('#shieldInfo').show();
		}

		setValue(value) {
			if(value) {
				$('#shieldInfo').text(value);

				this.show();
			} else {
				this.hide();
			}
		}
	}

	class ShieldTimer {
		constructor() {
			this.bindListener();
			this.start();
		}

		bindListener() {
			SWAM.on('shieldTimer', this.checkToStop.bind(this));
		}

		checkToStop(secondsLeft) {
			if(secondsLeft === 0 || secondsLeft === false) this.stop();
		}

		countdown() {
			SWAM.trigger('shieldTimer', [this.secondsLeft--]);
		}

		start() {
			this.secondsLeft = SHIELD.SPAWN_SECONDS;

			this.intervalId = setInterval(this.countdown.bind(this), 1000);
			this.countdown();
		}

		stop() {
			SWAM.off('shieldTimer', this.checkToStop);

			if(this.intervalId) {
				clearInterval(this.intervalId);
				this.intervalId = null;
			}
		}
	}

	class ShieldWatcher {
		constructor() {
			this.bindListeners();
		}

		bindMobDestroyed() {
			SWAM.on('mobDestroyed', this.mobDestroyed.bind(this));
		}

		bindListeners() {
			this.overrideMobDestroyed();
			this.bindMobDestroyed();

			SWAM.on('CTF_MatchEnded', this.pauseListener);
			SWAM.on('CTF_MatchStarted', this.bindMobDestroyed.bind(this));
		}

		isBaseShield(shieldPosition, baseShieldBoundingBox) {
			return (
				(shieldPosition.x >= baseShieldBoundingBox.topLeft.x) &&
				(shieldPosition.y >= baseShieldBoundingBox.topLeft.y) &&
				(shieldPosition.x <= baseShieldBoundingBox.bottomRight.x) &&
				(shieldPosition.y <= baseShieldBoundingBox.bottomRight.y)
			);
		}

		isEnemyBaseShield(shieldPosition, myTeam) {
			switch(myTeam) {
				case TEAMS.BLUE:
					return this.isBaseShield(shieldPosition, SHIELD.BASE_SPAWN_COORDINATES.RED);
					break;
				case TEAMS.RED:
					return this.isBaseShield(shieldPosition, SHIELD.BASE_SPAWN_COORDINATES.BLUE);
					break;
				default:
					return false;
			}
		}

		mobDestroyed(data) {
			if(data.type !== SHIELD.MOB_TYPE) return false;

			this.shieldGone(data);
		}

		overrideMobDestroyed() {
			if(window.mobDestroyedOverridden) return false;

			const mobsDestroy = Mobs.destroy;

			Mobs.destroy = function(data) {
				mobsDestroy.call(Mobs, data);

				SWAM.trigger('mobDestroyed', [data]);
			};

			window.mobDestroyedOverridden = true;
		}

		pauseListener() {
			SWAM.off('mobDestroyed');
		}

		shieldGone(data) {
			const shieldPosition = data.pos;
			const myTeam = Players.getMe().team;
			const isEnemyBaseShield = this.isEnemyBaseShield(shieldPosition, myTeam);

			if(isEnemyBaseShield) {
				new ShieldTimer();
			}
		}
	}

	class ShieldMain {
		constructor() {
			new ShieldWatcher();
			new ShieldKeyboard();
			new ShieldTeamChat();

			SWAM.on('gameWipe CTF_MatchStarted CTF_MatchEnded', this.resetComponents);

			console.log('Loaded Shield Timer');
		}

		bindUI() {
			new ShieldUI();
		}

		resetComponents() {
			SWAM.trigger('shieldTimer', [false]);
		}
	}

	var shieldMain;

	// Event handlers
	SWAM.on('gamePrep', () => {
		shieldMain = shieldMain || new ShieldMain();
		shieldMain.bindUI();
	});

	// Register mod
	SWAM.registerExtension(extensionConfig);
}();
