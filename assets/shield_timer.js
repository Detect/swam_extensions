/*

Thanks to Nuppet for original shield timer UI and idea. https://pastebin.com/01Z6bb4n

*/

!function() {
	// Settings
	const DEFAULT_SETTINGS = {
		isTeamChatEnabled: true,
		teamChatUpdateIntervals: '60,30,10,0'
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
		version: '0.8',
		settingsProvider: settingsProvider()
	};

	const MESSAGES = {
		DISABLED_TEAM_CHAT: 'Disabled shield timer team chat',
		ENABLED_TEAM_CHAT: 'Enabled shield timer team chat',
		SHIELD_SPAWNING: 'Enemy shield spawning!',
		TIMER_STARTED: 'Started enemy shield timer',
		TIMER_STOPPED: 'Stopped enemy shield timer',
		TIMER_UPDATED: (secondsLeft) => `${secondsLeft} seconds till enemy shield`
	};

	const TEAMS = {
		BLUE: 1,
		RED: 2
	};

	const KEY_CODES = {
		TOGGLE_TEAM_CHAT: 66, // 'b'
		TOGGLE_TIMER: 78 // 'n'
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
			const toggleTeamChat = (event.keyCode === KEY_CODES.TOGGLE_TEAM_CHAT);
			const toggleTimer = (event.keyCode === KEY_CODES.TOGGLE_TIMER);

			if(toggleTeamChat) {
				// Toggle team chat or send current timer to team chat
				const triggerEvent = userSettings.isTeamChatEnabled ? 'shieldTimerToggleTeamChat' : 'shieldTimerSendTeamChat';

				SWAM.trigger(triggerEvent);
			} else if(toggleTimer) {
				shieldMain.toggle();
			}
		}
	}

	class ShieldTeamChat {
		constructor() {
			this.bindListeners();
			this.enabled = userSettings.isTeamChatEnabled;
		}

		bindListeners() {
			SWAM.on('shieldTimerUpdate', this.updateTeamChat.bind(this));
			SWAM.on('shieldTimerToggleTeamChat', this.toggleTeamChat.bind(this));
			SWAM.on('shieldTimerSendTeamChat', this.send.bind(this));
		}

		send() {
			const message = MESSAGES.TIMER_UPDATED(this.secondsLeft);

			if(!!this.secondsLeft) Network.sendTeam(message);
		}

		toggleTeamChat() {
			const message = this.enabled ? MESSAGES.DISABLED_TEAM_CHAT : MESSAGES.ENABLED_TEAM_CHAT;

			Network.sendTeam(message);

			this.enabled = !this.enabled;
		}

		updateTeamChat(secondsLeft) {
			this.secondsLeft = secondsLeft;

			if(!this.enabled || !userSettings.isTeamChatEnabled) return;

			var message;
			const isTimerStarted = (secondsLeft === SHIELD.SPAWN_SECONDS);
			const isTimerStopped = (secondsLeft === false);
			const shouldSendChatUpdate = userSettings.teamChatUpdateIntervals.includes(parseInt(secondsLeft));
			const isShieldSpawning = ((secondsLeft === 0) && shouldSendChatUpdate);

			if(isTimerStarted) {
				message = MESSAGES.TIMER_STARTED;
			} else if(isTimerStopped) {
				message = MESSAGES.TIMER_STOPPED;
			} else if(isShieldSpawning) {
				message = MESSAGES.SHIELD_SPAWNING;
			} else if(shouldSendChatUpdate) {
				message = MESSAGES.TIMER_UPDATED(secondsLeft);
			}

			if(!!message) Network.sendTeam(message);
		}
	}

	class ShieldUI {
		constructor() {
			this.addStyles();
			this.createShieldInfo();
			this.bindListener();
		}

		addStyles() {
			const styles = `
				<style id='shieldTimerSwamModExtensionStyles" type='text/css'>
					#shieldInfo {
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
					}
				</style>
			`;

			$('body').append(styles);
		}

		bindListener() {
			SWAM.on('shieldTimerUpdate shieldTimerStop', this.setValue.bind(this));
		}

		createShieldInfo() {
			const shieldInfoExists = !!$('#shieldInfo').length;

			if(shieldInfoExists) return false;

			const $shieldInfo = $("<div id='shieldInfo'/>");

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
		}

		bindListener() {
			SWAM.on('shieldTimerUpdate', this.checkToStop.bind(this));
			SWAM.on('shieldTimerStart', this.start.bind(this));
			SWAM.on('shieldTimerStop', this.stop.bind(this));
		}

		checkToStop(secondsLeft) {
			if(secondsLeft === 0 || secondsLeft === false) this.stop();
		}

		countdown() {
			SWAM.trigger('shieldTimerUpdate', [this.secondsLeft--]);
		}

		restart() {
			this.stop();
			this.start();
		}

		start() {
			this.stop();

			this.secondsLeft = SHIELD.SPAWN_SECONDS;

			this.intervalId = setInterval(this.countdown.bind(this), 1000);
			this.countdown();

			shieldMain.active = true;
		}

		stop() {
			if(this.intervalId) {
				clearInterval(this.intervalId);
				this.intervalId = null;
			}

			shieldMain.active = false;
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

			if(isEnemyBaseShield) shieldMain.start();
		}
	}

	class ShieldMain {
		constructor() {
			new ShieldWatcher();
			new ShieldKeyboard();
			new ShieldTeamChat();
			new ShieldTimer();

			this.active = false;

			SWAM.on('gameWipe CTF_MatchStarted CTF_MatchEnded', this.stopQuiet);

			console.log('Loaded Shield Timer');
		}

		bindUI() {
			new ShieldUI();
		}

		start() {
			SWAM.trigger('shieldTimerStart');
		}

		stop() {
			SWAM.trigger('shieldTimerUpdate', [false]);
		}

		stopQuiet() {
			SWAM.trigger('shieldTimerStop');
		}

		toggle() {
			if(this.active) {
				this.stop();
			} else {
				this.start();
			}
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
