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
	var teamWeights, messages, myOldTeam, numBluePlayers, numRedPlayers;

	const extensionConfig = {
		name: 'Improved Shuffle for CTF',
		id: 'Shuffle',
		description: 'Ask to join other team to help balance CTF games.',
		author: 'Detect',
		version: '0.3'
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

	// Functions

	addModal = () => {
		const $modal = `
			<div id='shuffleModal' style='
				background-color: rgba(0,0,0,0.8);
				border: 1px solid #999;
				border-radius: 12px;
				top: 150px;
				padding: 20px 0;
				position: absolute;
				width: 100%;
				pointer-events: auto;
				z-index: 1;
			'>
				<p>You are on ${getMyTeamName()} team.</p>
				<p>${this.messages}</p>
				<p>Do you want to try and re-join ${getTeamName(this.teamToJoin)} team?</p>
				<button class='js-btn-shuffle' style='
					background-color: #DDD;
					border-radius: 6px;
					cursor: pointer;
					font-size: 20px;
					padding: 10px;
					margin: 10px;
					width: 100px;
				'>
					Yes
				</button>
				<button class='js-btn-shuffle' style='
					background-color: #DDD;
					border-radius: 6px;
					cursor: pointer;
					font-size: 20px;
					padding: 10px;
					margin: 10px;
					width: 100px;
				'>
					No
				</button>
			</div>
		`;

		$('#gamespecific').append($modal);
	}

	// TODO
	checkBounties = () => {
	}

	// TODO
	checkCaptures = () => {
	}

	checkNumberOfPlayers = () => {
		getNumberOfPlayers();

		const message = `There are ${this.numBluePlayers} blue players vs. ${this.numRedPlayers} red players. `

		this.messages += message;

		if(this.numBluePlayers > this.numRedPlayers) {
			this.teamWeights.blue += WEIGHTS.PLAYERS * Math.max(0, this.numBluePlayers - this.numRedPlayers - 2);
		} else if(this.numRedPlayers > this.numBluePlayers) {
			this.teamWeights.red += WEIGHTS.PLAYERS * Math.max(0, this.numRedPlayers - this.numBluePlayers - 2);
		}
	}

	checkTeamsBalance = () => {
		console.log('Shuffle: Checking teams balance');

		this.myOldTeam = Players.getMe().team;

		resetTeamWeights();

		checkNumberOfPlayers();
		// checkCaptures();
		// checkBounties();

		console.log(`Shuffle: ${this.messages}`);

		checkTeamsWeightsAndRebalance();
	}

	checkTeamsWeightsAndRebalance = () => {
		const myPlayerId = Players.getMe().id;
		const askToJoinRed = (this.teamWeights.blue > this.teamWeights.red) && isPlayerOnBlueTeam(myPlayerId);
		const askToJoinBlue = (this.teamWeights.red > this.teamWeights.blue) && isPlayerOnRedTeam(myPlayerId);

		console.log('teamWeights', this.teamWeights, askToJoinRed, askToJoinBlue);

		if(!askToJoinRed && !askToJoinBlue) return;

		this.teamToJoin = askToJoinRed ? TEAMS.RED : TEAMS.BLUE;
		addModal();
	}

	clickButton = (event) => {
		const value = $(event.target).text().trim();

		$('#shuffleModal').remove();

		if(value === 'Yes') rejoin();
	};

	getMyTeamName = () => getTeamName(Players.getMe().team);

	getNumberOfPlayers = () => [this.numBluePlayers, this.numRedPlayers] = partition(getNonSpectatingPlayerIds(), isPlayerOnBlueTeam).map(playerIds => playerIds.length);

	getNonSpectatingPlayerIds = () => Object.keys(Players.getIDs()).filter(playerId => !Players.get(playerId).removedFromMap);

	getTeamName = (teamId) => Object.keys(TEAMS).filter(key => TEAMS[key] === teamId)[0].toLowerCase();

	isPlayerOnBlueTeam = (playerId) => isPlayerOnTeam(playerId, TEAMS.BLUE);

	isPlayerOnRedTeam = (playerId) => isPlayerOnTeam(playerId, TEAMS.RED);

	isPlayerOnTeam = (playerId, teamId) => Players.get(playerId).team === teamId;

	matchEnded = (data) => setTimeout(checkTeamsBalance, 31000);

	rejoin = () => {
		SWAM.one('gamePrep', () => setTimeout(rejoinMessage, 1000));

		Network.reconnect();
	}

	rejoinMessage = () => {
		// Didn't change teams
		if(this.myOldTeam === Players.getMe().team) return;

		getNumberOfPlayers();

		const message = `Switched to ${getMyTeamName()} to balance teams. ${this.numBluePlayers} blue vs ${this.numRedPlayers} red`;

		Network.sendChat(message);
	}

	resetTeamWeights = () => {
		this.teamWeights = {
			blue: 0,
			red: 0
		};

		this.messages = '';
	}

	// Helper functions
	partition = (array, isValid) => {
		return array.reduce(([pass, fail], elem) => {
			return isValid(elem) ? [[...pass, elem], fail] : [pass, [...fail, elem]];
		}, [[], []]);
	}

	// Event handlers
	SWAM.on('CTF_MatchEnded', matchEnded);

	$(document).on('click', '.js-btn-shuffle', clickButton);

	// Register mod
	SWAM.registerExtension(extensionConfig);
}();
