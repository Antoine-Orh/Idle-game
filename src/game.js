var game = new Phaser.Game(1875, 970, Phaser.AUTO, '');


game.state.add('play', {
    preload: function() {
        this.game.load.image('mine', 'assets/background/mine.jpg');
        this.game.load.image('mineshaft', 'assets/background/mineshaft.png');
        this.game.load.image('herobrine', 'assets/background/herobrine.jpg');
        this.game.load.image('minerail', 'assets/background/minerail.jpg');
        this.game.load.image('herobrine2', 'assets/background/herobrine2.png');
        this.game.load.image('minepioche', 'assets/background/minepioche.webp');
        this.game.load.image('diamond', 'assets/background/diamond.jpg');

        this.game.load.image('stone', 'assets/stone/stone.jpg');
        this.game.load.image('ironore', 'assets/stone/ironore.png');
        this.game.load.image('goldore', 'assets/stone/goldore.png');


        // build panel for upgrades
        var bmd = this.game.add.bitmapData(250, 500);
        bmd.ctx.fillStyle = '#9a783d';
        bmd.ctx.strokeStyle = '#35371c';
        bmd.ctx.lineWidth = 12;
        bmd.ctx.fillRect(0, 0, 250, 500);
        bmd.ctx.strokeRect(0, 0, 250, 500);
        this.game.cache.addBitmapData('upgradePanel', bmd);

        var buttonImage = this.game.add.bitmapData(476, 48);
        buttonImage.ctx.fillStyle = '#e6dec7';
        buttonImage.ctx.strokeStyle = '#35371c';
        buttonImage.ctx.lineWidth = 4;
        buttonImage.ctx.fillRect(0, 0, 225, 48);
        buttonImage.ctx.strokeRect(0, 0, 225, 48);
        this.game.cache.addBitmapData('button', buttonImage);

        // the main player
        this.player = {
            clickDmg: 1,
            gold: 50,
            dps: 0
        };

        // world progression
        var lamine = 0;
        this.level = 1;
        // how many monsters have we killed during this level
        this.levelKills = 0;
        // how many monsters are required to advance a level
        this.levelKillsRequired = 10;
    },
    create: function() {
        var state = this;

        background = this.add.image(0, 0, this.currentMine());
        background.height = game.height;
        background.width = game.width;
        
        this.upgradePanel = this.game.add.image(10, 70, this.game.cache.getBitmapData('upgradePanel'));
        var upgradeButtons = this.upgradePanel.addChild(this.game.add.group());
        upgradeButtons.position.setTo(8, 8);

        var upgradeButtonsData = [
            {icon: 'dagger', name: 'Attack', level: 0, cost: 5, purchaseHandler: function(button, player) {
                player.clickDmg += 1;
            }},
            {icon: 'swordIcon1', name: 'Auto-Attack', level: 0, cost: 25, purchaseHandler: function(button, player) {
                player.dps += 5;
            }}
        ];

        var button;
        upgradeButtonsData.forEach(function(buttonData, index) {
            button = state.game.add.button(0, (50 * index), state.game.cache.getBitmapData('button'));
            button.icon = button.addChild(state.game.add.image(6, 6, buttonData.icon));
            button.text = button.addChild(state.game.add.text(42, 6, buttonData.name + ': ' + buttonData.level, {font: '16px Arial Black'}));
            button.details = buttonData;
            button.costText = button.addChild(state.game.add.text(42, 24, 'Cost: ' + buttonData.cost, {font: '16px Arial Black'}));
            button.events.onInputDown.add(state.onUpgradeButtonClick, state);

            upgradeButtons.addChild(button);
        });

        var monsterData = [
            {name: this.NameGen(),        image: this.mineraux(),        maxHealth: 10},

        ];
        this.monsters = this.game.add.group();

        var monster;
        monsterData.forEach(function(data) {
            // create a sprite for them off screen
            monster = state.monsters.create(1000, state.game.world.centerY, data.image);
            // use the built in health component
            monster.health = monster.maxHealth = data.maxHealth;
            // center anchor
            monster.anchor.setTo(0.5, 1);
            // reference to the database
            monster.details = data;

            //enable input so we can click it!
            monster.inputEnabled = true;
            monster.events.onInputDown.add(state.onClickMonster, state);

            // hook into health and lifecycle events
            monster.events.onKilled.add(state.onKilledMonster, state);
            monster.events.onRevived.add(state.onRevivedMonster, state);
        });

        // display the monster front and center
        this.currentMonster = this.monsters.getRandom();
        this.currentMonster.position.set(this.game.world.centerX + 100, this.game.world.centerY + 50);

        this.monsterInfoUI = this.game.add.group();
        this.monsterInfoUI.position.setTo(this.currentMonster.x - 220, this.currentMonster.y + 120);
        this.monsterNameText = this.monsterInfoUI.addChild(this.game.add.text(0, 0, this.currentMonster.details.name, {
            font: '48px Arial Black',
            fill: '#fff',
            strokeThickness: 4
        }));
        this.monsterHealthText = this.monsterInfoUI.addChild(this.game.add.text(0, 80, this.currentMonster.health + ' HP', {
            font: '32px Arial Black',
            fill: '#ff0000',
            strokeThickness: 4
        }));

        this.dmgTextPool = this.add.group();
        var dmgText;
        for (var d=0; d<50; d++) {
            dmgText = this.add.text(0, 0, '1', {
                font: '64px Arial Black',
                fill: '#fff',
                strokeThickness: 4
            });
            // start out not existing, so we don't draw it yet
            dmgText.exists = false;
            dmgText.tween = game.add.tween(dmgText)
                .to({
                    alpha: 0,
                    y: 100,
                    x: this.game.rnd.integerInRange(100, 700)
                }, 1000, Phaser.Easing.Cubic.Out);

            dmgText.tween.onComplete.add(function(text, tween) {
                text.kill();
            });
            this.dmgTextPool.add(dmgText);
        }

        // 100ms 10x a second
        this.dpsTimer = this.game.time.events.loop(100, this.onDPS, this);

        // setup the world progression display
        this.levelUI = this.game.add.group();
        this.levelUI.position.setTo(this.game.world.centerX, 30);
        this.levelText = this.levelUI.addChild(this.game.add.text(0, 0, 'Mine: ' + this.level, {
            font: '24px Arial Black',
            fill: '#fff',
            strokeThickness: 4
        }));
        this.levelKillsText = this.levelUI.addChild(this.game.add.text(0, 30, 'blocs minés: ' + this.levelKills + '/' + this.levelKillsRequired, {
            font: '24px Arial Black',
            fill: '#fff',
            strokeThickness: 4
        }));
    },
    currentMine: function(){
        var lamine = [
            'mine',
            'mineshaft',
            'herobrine',
            'herobrine2',
            'minerail',
            'minepioche',
            'diamond'
        ];
        var minerandom = lamine[Math.floor(Math.random()*lamine.length)];
        return minerandom;
    },

    mineraux: function(){
        var orerandom = [
            'stone',
            'ironore',
            'goldore'
        ];
        var theore = orerandom[Math.floor(Math.random()*orerandom.length)];
        return theore;
    },

    NameGen: function(){
        var prefixe = [
            "Graph",
            "Ura",
            "Gra",
            "Tita",
            "Caillou",
            "Obsi",
            "roch"
          ];

        var suffixe = [
            "ium",
            "ite",
            "ène",
            "dienne",
            "dium",
            "onium"
          ];
          
        var leprefixe = prefixe[Math.floor(Math.random()*prefixe.length)];
        var lesuffixe = suffixe[Math.floor(Math.random()*suffixe.length)];

        return leprefixe+lesuffixe;
    },
    onDPS: function() {
        if (this.player.dps > 0) {
            if (this.currentMonster && this.currentMonster.alive) {
                var dmg = this.player.dps / 10;
                this.currentMonster.damage(dmg);
                // update the health text
                this.monsterHealthText.text = this.currentMonster.alive ? Math.round(this.currentMonster.health) + ' HP' : 'DEAD';
            }
        }
    },
    onUpgradeButtonClick: function(button, pointer) {
        // make this a function so that it updates after we buy
        function getAdjustedCost() {
            return Math.ceil(button.details.cost + (button.details.level * 1.46));
        }

        if (this.player.gold - getAdjustedCost() >= 0) {
            this.player.gold -= getAdjustedCost();
            this.playerGoldText.text = 'Gold: ' + this.player.gold;
            button.details.level++;
            button.text.text = button.details.name + ': ' + button.details.level;
            button.costText.text = 'Cost: ' + getAdjustedCost();
            button.details.purchaseHandler.call(this, button, this.player);
        }
    },
    onKilledMonster: function(monster) {
        // move the monster off screen again
        monster.position.set(1000, this.game.world.centerY);

        // pick a new monster
        this.currentMonster = this.monsters.getRandom();
        // upgrade the monster based on level
        this.currentMonster.maxHealth = Math.ceil(this.currentMonster.details.maxHealth + ((this.level - 1) * 10.6));
        // make sure they are fully healed
        this.currentMonster.revive(this.currentMonster.maxHealth);
    },
    onRevivedMonster: function(monster) {
        monster.position.set(this.game.world.centerX + 100, this.game.world.centerY + 50);
        // update the text display
        this.monsterNameText.text = monster.details.name;
        this.monsterHealthText.text = monster.health + 'HP';
    },
    onClickMonster: function(monster, pointer) {
        // apply click damage to monster
        this.currentMonster.damage(this.player.clickDmg);

        // grab a damage text from the pool to display what happened
        var dmgText = this.dmgTextPool.getFirstExists(false);
        if (dmgText) {
            dmgText.text = this.player.clickDmg;
            dmgText.reset(pointer.positionDown.x, pointer.positionDown.y);
            dmgText.alpha = 1;
            dmgText.tween.start();
        }

        // update the health text
        this.monsterHealthText.text = this.currentMonster.alive ? this.currentMonster.health + ' HP' : 'DEAD';
    }
});

game.state.start('play');
