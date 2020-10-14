"use strict";
/*

Thanks to Nuppet for original shield timer UI and idea. https://pastebin.com/01Z6bb4n

*/

!function() {
	// Settings
	const DEFAULT_SETTINGS = {
		isShieldSpawnedEnabled: true,
	};

	var userSettings = DEFAULT_SETTINGS;

	const settingsProvider = () => {
		let sp = new SettingsProvider(DEFAULT_SETTINGS);
		let section = sp.addSection('Shield Timer');
		section.addBoolean('isShieldSpawnedEnabled', 'Show spawned shield direction/distance messages');

		return sp;
	};

	const extensionConfig = {
		name: 'Shield Timer for CTF',
		id: 'ShieldTimer',
		description: 'Adds enemy base shield spawn timer to UI.',
		author: 'Detect',
		version: '1.5',
		settingsProvider: settingsProvider()
	};

	const KEY_CODES = {
		TOGGLE_TIMER: 78 // 'n'
	};

	const MESSAGES = {
		SHIELD_FOUND: (shield) => `Shield found ${shield.direction} ${shield.time} seconds away.`,
		TIMER_STARTED: (time) => `Started enemy shield timer at ${time}`,
		TIMER_STOPPED: (time) => `Stopped enemy shield timer at ${time}`,
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

	const SHIP_SPEED = 350;

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
			const toggleTimer = (event.keyCode === KEY_CODES.TOGGLE_TIMER);

			if(toggleTimer) {
				shieldMain.toggle();
			}
		}
	}

	class ShieldChat {
		constructor() {
			this.bindListeners();
		}

		bindListeners() {
			SWAM.on('shieldTimer:enemyShield:update', this.checkStartStop.bind(this));
			SWAM.on('shieldTimer:externalShield:found', this.foundShield.bind(this));
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

		foundShield(shield) {
			if(!userSettings.isShieldSpawnedEnabled) return;

			// Too far away
			if(shield.time > 10) return;

			const message = MESSAGES.SHIELD_FOUND(shield);

			UI.addChatMessage(message);
		}
	}

	class ShieldStyles {
		constructor() {
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
	}

	class ShieldUI {
		constructor() {
			this.createShieldInfo();
			this.bindListener();
		}

		bindListener() {
			SWAM.on('shieldTimer:enemyShield:update shieldTimer:enemyShield:stop', this.setValue.bind(this));
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
			SWAM.on('shieldTimer:enemyShield:update', this.checkToStop.bind(this));
			SWAM.on('shieldTimer:enemyShield:start', this.start.bind(this));
			SWAM.on('shieldTimer:enemyShield:stop', this.stop.bind(this));
		}

		checkToStop(secondsLeft, _syncPlayer) {
			if(secondsLeft === 0 || secondsLeft === false) this.stop();
		}

		countdown() {
			SWAM.trigger('shieldTimer:enemyShield:update', [this.secondsLeft--, this.syncPlayer]);
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
			SWAM.on('mobAdded', this.shieldFoundForMob.bind(this));
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

		getBearingFromPoints(p1, p2) {
			let theta = Math.atan2(p2.x - p1.x, p1.y - p2.y);

			if (theta < 0.0) theta += 2 * Math.PI;

			const degrees = (180.0 / Math.PI) * theta;

			const adjustedDegrees =  Math.floor((degrees / 45.0) + 0.5);
			const bearings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
			const bearing = bearings[(adjustedDegrees % 8)];

			return bearing;
		}

		isShieldWithin(shieldPosition, boundingBox) {
			return (
				(shieldPosition.x >= boundingBox.topLeft.x) &&
				(shieldPosition.y >= boundingBox.topLeft.y) &&
				(shieldPosition.x <= boundingBox.bottomRight.x) &&
				(shieldPosition.y <= boundingBox.bottomRight.y)
			);
		}

		isEnemyBaseShield(shieldPosition, myTeam) {
			switch(myTeam) {
				case TEAMS.BLUE:
					return this.isShieldWithin(shieldPosition, SHIELD.BASE_SPAWN_COORDINATES.RED);
					break;
				case TEAMS.RED:
					return this.isShieldWithin(shieldPosition, SHIELD.BASE_SPAWN_COORDINATES.BLUE);
					break;
				default:
					return false;
			}
		}

		shieldFoundForMob(data) {
			if(data.type !== SHIELD.MOB_TYPE) return false;

			const me = Players.getMe();
			const shieldPosition = {
				x: data.posX,
				y: data.posY
			};

			const [x1, y1] = [AutoPilot.mapCoordX(me.pos.x), AutoPilot.mapCoordY(me.pos.y)];
			const [x2, y2] = [AutoPilot.mapCoordX(shieldPosition.x), AutoPilot.mapCoordY(shieldPosition.y)];

			const path = AutoPilot.SearchPath(x1, y1, x2, y2);

			var lastPosition = me.pos;
			var totalDistance = 0;

			for(let i in path) {
				let nextX = path[i][0] * 100 - 16384 + 50;
				let nextY = path[i][1] * 100 - 8192 + 50;

				let distance = Tools.distance(lastPosition.x, lastPosition.y, nextX, nextY);

				totalDistance += distance;

				lastPosition = {
					x: nextX,
					y: nextY,
				}
			}

			const shield = Object.assign({}, shieldPosition, {
				direction: this.getBearingFromPoints(me.pos, shieldPosition),
				distance: totalDistance,
				time: parseInt(totalDistance / SHIP_SPEED),
			});

			SWAM.trigger('shieldTimer:externalShield:found', [shield]);
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

			SWAM.trigger('shieldTimer:enemyShield:start');
		}

		startSynced(player, secondsLeft) {
			if(this.active) return;

			this.sync = true;

			SWAM.trigger('shieldTimer:enemyShield:start', [{
				player: player,
				secondsLeft: secondsLeft,
			}]);
		}

		stop() {
			SWAM.trigger('shieldTimer:enemyShield:update', [false, null]);
		}

		stopQuiet() {
			SWAM.trigger('shieldTimer:enemyShield:stop');
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

	SWAM.on('gameRunning', () => new ShieldStyles());

	// Register mod
	SWAM.registerExtension(extensionConfig);
}();
