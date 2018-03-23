/*

Thanks to Nuppet for original shield timer UI and idea. https://pastebin.com/01Z6bb4n

*/

!function() {
	// Settings
	settingsProvider = () => {
		const defaultSettings = { isTeamChatEnabled: true };

		onApply = (settings) => SETTINGS.teamChatEnabled = settings.isTeamChatEnabled;

		let sp = new SettingsProvider(defaultSettings, onApply);
		let section = sp.addSection('Shield Timer');
		section.addBoolean('isTeamChatEnabled', 'Automatically send shield timer to team chat');

		return sp;
	}

	const extensionConfig = {
		name: 'Shield Timer for CTF',
		id: 'ShieldTimer',
		description: 'Adds enemy base shield spawn timer to UI and chat.',
		author: 'Detect',
		version: '0.2',
		settingsProvider: settingsProvider()
	};

	const MESSAGES = {
		SPAWNING: 'Shield spawning!',
		STARTED: 'Started shield timer at enemy base',
		STOPPED: 'Stopped shield timer',
		UPDATED: (secondsLeft) => `${secondsLeft} seconds till shield`
	};

	const SETTINGS = {
		teamChatEnabled: true
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
		TEAM_CHAT_SECONDS: [90, 60, 30, 20, 10, 5]
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

			if(SETTINGS.teamChatEnabled) {
				// Force stop timer
				SWAM.trigger('shieldTimerStopped');

				shieldMain.resetComponents();
			} else {
				// Send current timer to team chat
				SWAM.trigger('shieldTimerKeypress');
			}
		}
	}

	class ShieldTeamChat {
		constructor() {
			this.bindListeners();
		}

		bindListeners() {
			SWAM.on('shieldTimerStopped', this.forceStopped.bind(this));
			SWAM.on('shieldTimer', this.updateChat.bind(this));
			SWAM.on('shieldTimerKeypress', this.forceChat.bind(this));
		}

		forceChat() {
			const message = MESSAGES.UPDATED(this.secondsLeft);

			if(!!this.secondsLeft) Network.sendTeam(message);
		}

		forceStopped() {
			if(this.secondsLeft && SETTINGS.teamChatEnabled) Network.sendTeam(MESSAGES.STOPPED);
		}

		updateChat(secondsLeft) {
			this.secondsLeft = secondsLeft;

			if(secondsLeft === false) return;

			var message;
			const isTimerStarted = secondsLeft === SHIELD.SPAWN_SECONDS;
			const isTimerStopped = secondsLeft === 0;
			const shouldSendChatUpdate = SHIELD.TEAM_CHAT_SECONDS.includes(secondsLeft);

			if(isTimerStarted) {
				message = MESSAGES.STARTED;
			} else if(shouldSendChatUpdate) {
				message = MESSAGES.UPDATED(secondsLeft);
			} else if(isTimerStopped) {
				message = MESSAGES.SPAWNING;
			}

			const shouldSendChat = !!message && SETTINGS.teamChatEnabled;

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
