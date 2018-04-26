"use strict";
/*

Factors to compare

- number of players on red vs blue
- TODO: average bounty of players on each team
- TODO: captures
- TODO: player.scorePlace .totalKills .killCount .deathCount

Deciding whether to switch teams
- what is the difference in teams weight?
- if player is on OP team and re-join results in probably joining other team, ask to re-join

*/

!function() {
	const extensionConfig = {
		name: 'Improved Shuffle for CTF',
		id: 'Shuffle',
		description: 'Ask to join other team to help balance CTF games.',
		author: 'Detect',
		version: '0.8'
	};

	const TEAMS = {
		BLUE: 1,
		RED: 2
	};

	const WEIGHTS = {
		BOUNTIES: 1,
		CAPTURES: 1,
		PLAYERS: 2
	}

	// Register mod
	SWAM.registerExtension(extensionConfig);

	class Shuffler {
		constructor() {
			SWAM.on('CTF_MatchEnded', this.matchEnded.bind(this));

			$(document).on('click', '#shuffle-modal button', this.clickButton.bind(this));

			this.addStyles();
		}

		// Functions

		addModal() {
			const $modal = `
				<div id='shuffle-modal'>
					<p>You are on ${this.getMyTeamName()} team.</p>
					<p>${this.messages}</p>
					<p>Do you want to try and re-join ${this.getTeamName(this.teamToJoin)} team?</p>
					<button class='btn-shuffle'>Yes</button>
					<button class='btn-shuffle'>No</button>
				</div>
			`;

			$('#gamespecific').append($modal);
		}

		addStyles() {
			const styles = `
				<style id='shuffleSwamModExtensionStyles" type='text/css'>
					#shuffle-modal {
						background-color: rgba(0,0,0,0.8);
						border: 1px solid #999;
						border-radius: 12px;
						top: 150px;
						padding: 20px 0;
						position: absolute;
						width: 100%;
						pointer-events: auto;
						z-index: 1;
					}

					.btn-shuffle {
						background-color: #DDD;
						border-radius: 6px;
						cursor: pointer;
						font-size: 20px;
						padding: 10px;
						margin: 10px;
						width: 100px;
					}
				</style>
			`;

			$('body').append(styles);
		}

		// TODO
		checkBounties() {
		}

		// TODO
		checkCaptures() {
		}

		checkNumberOfPlayers() {
			this.getNumberOfPlayers();

			const message = `There are ${this.numBluePlayers} blue players vs. ${this.numRedPlayers} red players. `

			this.messages += message;

			if(this.numBluePlayers > this.numRedPlayers) {
				this.teamWeights.blue += WEIGHTS.PLAYERS * Math.max(0, this.numBluePlayers - this.numRedPlayers - 2);
			} else if(this.numRedPlayers > this.numBluePlayers) {
				this.teamWeights.red += WEIGHTS.PLAYERS * Math.max(0, this.numRedPlayers - this.numBluePlayers - 2);
			}
		}

		checkTeamsBalance() {
			console.log('Shuffle: Checking teams balance');

			this.myOldTeam = Players.getMe().team;

			this.resetTeamWeights();

			this.checkNumberOfPlayers();
			// this.checkCaptures();
			// this.checkBounties();

			console.log(`Shuffle: ${this.messages}`);

			this.checkTeamsWeightsAndRebalance();
		}

		checkTeamsWeightsAndRebalance() {
			const myPlayerId = Players.getMe().id;
			const askToJoinRed = (this.teamWeights.blue > this.teamWeights.red) && this.isPlayerOnBlueTeam(myPlayerId);
			const askToJoinBlue = (this.teamWeights.red > this.teamWeights.blue) && this.isPlayerOnRedTeam(myPlayerId);

			console.log('teamWeights', this.teamWeights, askToJoinRed, askToJoinBlue);

			if(!askToJoinRed && !askToJoinBlue) return;

			this.teamToJoin = askToJoinRed ? TEAMS.RED : TEAMS.BLUE;
			this.addModal();
		}

		clickButton(event) {
			const value = $(event.target).text().trim();

			$('#shuffle-modal').remove();

			if(value === 'Yes') this.rejoin();
		};

		getMyTeamName() {
			return this.getTeamName(Players.getMe().team);
		}

		getNumberOfPlayers() {
			[this.numBluePlayers, this.numRedPlayers] = this.partition(this.getNonSpectatingPlayerIds(), this.isPlayerOnBlueTeam.bind(this)).map(playerIds => playerIds.length);
		}

		getNonSpectatingPlayerIds() {
			return Object.keys(Players.getIDs()).filter(playerId => !Players.get(playerId).removedFromMap);
		}

		getTeamName(teamId) {
			return Object.keys(TEAMS).filter(key => TEAMS[key] === teamId)[0].toLowerCase();
		}

		isPlayerOnBlueTeam(playerId) {
			return this.isPlayerOnTeam(playerId, TEAMS.BLUE);
		}

		isPlayerOnRedTeam(playerId) {
			return this.isPlayerOnTeam(playerId, TEAMS.RED);
		}

		isPlayerOnTeam(playerId, teamId) {
			return Players.get(playerId).team === teamId;
		}

		matchEnded(data) {
			setTimeout(this.checkTeamsBalance.bind(this), 31000);
		}

		rejoin() {
			SWAM.one('gamePrep', () => setTimeout(this.rejoinMessage.bind(this), 1000));

			Network.reconnect();
		}

		rejoinMessage() {
			// Didn't change teams
			if(this.myOldTeam === Players.getMe().team) return;

			this.getNumberOfPlayers();

			const message = `Switched to ${this.getMyTeamName()} to balance teams. ${this.numBluePlayers} blue vs ${this.numRedPlayers} red`;

			Network.sendChat(message);
		}

		resetTeamWeights() {
			this.teamWeights = {
				blue: 0,
				red: 0
			};

			this.messages = '';
		}

		// Helper functions
		partition(array, isValid) {
			return array.reduce(([pass, fail], elem) => {
				return isValid(elem) ? [[...pass, elem], fail] : [pass, [...fail, elem]];
			}, [[], []]);
		}
	}

	new Shuffler();
}();
