/*

Thanks to Nuppet for original shield timer UI and idea. https://pastebin.com/01Z6bb4n

*/

!function() {
	// Settings
	const DEFAULT_SETTINGS = {
		isTeamChatEnabled: true,
		teamChatUpdateIntervals: '90,30,10'
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
		version: '1.0',
		settingsProvider: settingsProvider()
	};

	const CHAT_MESSAGES = {
		TEAM_TYPE: 3,
	};

	const KEY_CODES = {
		TOGGLE_TEAM_CHAT: 66, // 'b'
		TOGGLE_TIMER: 78 // 'n'
	};

	const MESSAGES = {
		DISABLED_TEAM_CHAT: 'Disabled shield timer team chat',
		ENABLED_TEAM_CHAT: 'Enabled shield timer team chat',
		SHIELD_SPAWNING: 'Enemy shield spawning!',
		TIMER_STARTED: (time) => `Started enemy shield timer at ${time}`,
		TIMER_STOPPED: (time) => `Stopped enemy shield timer at ${time}`,
		TIMER_SYNCED: (secondsLeft, playerName, time) => `Synced enemy shield timer for ${secondsLeft} seconds by ${playerName} at ${time}`,
		TIMER_UPDATED: (secondsLeft) => `${secondsLeft} seconds till enemy shield`
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
		POWERUP_TYPE: 1,
		SPAWN_SECONDS: 105 - 2, // two second delay
	};

	const TEAMS = {
		BLUE: 1,
		RED: 2
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

	class ChatListener {
		constructor() {
			this.bindListener();
		}

		bindListener() {
			SWAM.on('chatLineAdded', this.checkTimerMessages.bind(this));
		}

		checkTimerMessages(player, text, type) {
			const isTeamChat = (type === CHAT_MESSAGES.TEAM_TYPE);
			const isSelf = (player.id === Players.getMe().id);

			if(!isTeamChat || isSelf) return;

			const updatedMessage = `^${MESSAGES.TIMER_UPDATED('([0-9]+)')}$`;
			const reUpdatedMessage = new RegExp(updatedMessage);
			const matches = text.match(reUpdatedMessage);

			if(matches === null) return;

			const secondsLeft = parseInt(matches[1]);

			if(secondsLeft <= 0 || secondsLeft >= SHIELD.SPAWN_SECONDS) return;

			shieldMain.startSynced(player, secondsLeft);
		}
	}

	class ShieldChat {
		constructor() {
			this.bindListeners();
			this.enabled = userSettings.isTeamChatEnabled;
		}

		bindListeners() {
			SWAM.on('shieldTimerStart', this.checkSynced.bind(this));
			SWAM.on('shieldTimerSendTeamChat', this.sendTeamChat.bind(this));
			SWAM.on('shieldTimerToggleTeamChat', this.toggleTeamChat.bind(this));
			SWAM.on('shieldTimerUpdate', this.updateTeamChat.bind(this));
			SWAM.on('shieldTimerUpdate', this.checkStartStop.bind(this));
		}

		checkSynced(options) {
			if(!options || !options.player || !options.secondsLeft) return;

			const time = new Date().toLocaleTimeString();
			const message = MESSAGES.TIMER_SYNCED(options.secondsLeft, options.player.name, time);

			UI.addChatMessage(message);
		}

		checkStartStop() {
			// Minus one to prevent dupe start messages
			const isStart = (this.secondsLeft === (SHIELD.SPAWN_SECONDS - 1));
			const isStop = (this.secondsLeft === false);
			const time = new Date().toLocaleTimeString();

			let message;

			if(isStart) {
				message = MESSAGES.TIMER_STARTED(time);
			} else if(isStop) {
				message = MESSAGES.TIMER_STOPPED(time);
			}

			if(!!message) UI.addChatMessage(message);
		}

		sendTeamChat() {
			const message = MESSAGES.TIMER_UPDATED(this.secondsLeft);

			if(!!this.secondsLeft) Network.sendTeam(message);
		}

		toggleTeamChat() {
			const message = this.enabled ? MESSAGES.DISABLED_TEAM_CHAT : MESSAGES.ENABLED_TEAM_CHAT;

			this.enabled = !this.enabled;

			UI.addChatMessage(message);
		}

		updateTeamChat(secondsLeft, _syncPlayer) {
			this.secondsLeft = secondsLeft;

			if(!this.enabled || !userSettings.isTeamChatEnabled || shieldMain.sync) return;

			let message;
			const shouldSendChatUpdate = userSettings.teamChatUpdateIntervals.includes(parseInt(secondsLeft));
			const isShieldSpawning = ((secondsLeft === 0) && shouldSendChatUpdate);

			if(isShieldSpawning) {
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

		setValue(secondsLeft, syncPlayer) {
			if(!secondsLeft) {
				this.hide();
				return;
			}

			const text = (syncPlayer !== null) ? `${secondsLeft} (${syncPlayer.name})` : secondsLeft;
			$('#shieldInfo').text(text);
			this.show();
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

		checkToStop(secondsLeft, _syncPlayer) {
			if(secondsLeft === 0 || secondsLeft === false) this.stop();
		}

		countdown() {
			SWAM.trigger('shieldTimerUpdate', [this.secondsLeft--, this.syncPlayer]);
		}

		restart() {
			this.stop();
			this.start();
		}

		start(options) {
			this.stop();

			const isSync = (!!options && !!options.player && !!options.secondsLeft);

			this.syncPlayer = isSync ? options.player : null;
			this.secondsLeft = isSync ? options.secondsLeft : SHIELD.SPAWN_SECONDS;

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
			this.enable();
		}

		bindListeners() {
			SWAM.on('mobDestroyed', this.shieldGoneForMob.bind(this));
			SWAM.on('playerPowerUp', this.shieldGoneForPlayer.bind(this));
			SWAM.on('CTF_MatchEnded', this.disable.bind(this));
			SWAM.on('CTF_MatchStarted', this.enable.bind(this));
		}

		disable() {
			this.enabled = false;
		}

		enable() {
			this.enabled = true;
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

		shieldGone(objectType, data) {
			if(!this.enabled) return false;
			if(objectType === 'Mob' && data.type !== SHIELD.MOB_TYPE) return false;
			if(objectType === 'Player' && data.type !== SHIELD.POWERUP_TYPE) return false;

			const me = Players.getMe();
			const shieldPosition = (objectType === 'Player' ? me.pos : data.pos);
			const isEnemyBaseShield = this.isEnemyBaseShield(shieldPosition, me.team);

			if(isEnemyBaseShield) shieldMain.start();
		}

		shieldGoneForMob(data) {
			this.shieldGone('Mob', data);
		}

		shieldGoneForPlayer(data) {
			this.shieldGone('Player', data);
		}
	}

	class ShieldMain {
		constructor() {
			new ShieldWatcher();
			new ShieldKeyboard();
			new ShieldChat();
			new ShieldTimer();
			new ChatListener();

			this.active = false;
			this.sync = false;

			SWAM.on('gameWipe CTF_MatchStarted CTF_MatchEnded', this.stopQuiet);

			console.log('Loaded Shield Timer');
		}

		bindUI() {
			new ShieldUI();
		}

		start() {
			this.sync = false;

			SWAM.trigger('shieldTimerStart');
		}

		startSynced(player, secondsLeft) {
			if(this.active) return;

			this.sync = true;

			SWAM.trigger('shieldTimerStart', [{
				player: player,
				secondsLeft: secondsLeft,
			}]);
		}

		stop() {
			SWAM.trigger('shieldTimerUpdate', [false, null]);
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
