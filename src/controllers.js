function MainController($scope,$http,version,hsep,gamesep,gcep){
	$scope.prevStats = null;
	$scope.message = "";
	$scope.showStart = true;
	$scope.gameConfig = {
		startingHealth: 100,
		startingWave: 0,
		spaceShipAngularDamping: 0.85,
		spaceShipLinearDamping: 0.2,
		spaceShipMass: 10,
		spaceShipThrust: 600,
		spaceShipTorque: 1200,
		spaceShipAsteroidDamage: 25,
		asteroidExplodeVelocity: 40,
		asteroidLargePoints: 105,
		asteroidLargeRadius: 20,
		asteroidLargeMass: 800,
		asteroidMediumPoints: 202,
		asteroidMediumRadius: 10,
		asteroidMediumMass: 200,
		asteroidSmallPoints: 407,
		asteroidSmallRadius: 5,
		asteroidSmallMass: 50,
		asteroidBabyPoints: 921,
		bulletDensity: 2000.0,
		bulletFriction: 0.1,
		bulletRestitution: 0.25,
		bulletSpeed: 200,
		bulletLife: 1000,
		bulletRate: 300};
	$scope.gplus = function gplus(){
		var url = "https://accounts.google.com/o/oauth2/auth?redirect_uri=";
		url += "http://localhost:8080/asteroidsgame/oauth2.html";
		url += "&response_type=token&client_id=" + "890582885836.apps.googleusercontent.com";
		url += "&approval_prompt=force&scope="
		url += "https://www.googleapis.com/auth/plus.me https://www.googleapis.com/auth/userinfo.profile&access_type=online";
		//Open G Plus Window
		var win = window.open(url,"_blank","menubar=no,toolbar=no");
		window.oauthcallback = $scope.oauthSuccess;
	};
	$scope.oauthSuccess = function haveToken(oauth){
		$scope.oauth = oauth;
		$http.get('https://www.googleapis.com/plus/v1/people/me?access_token=' + oauth.access_token).success(function personSuccess(data){
			$scope.person = data;
			$scope.onStart();
		});
		$scope.$apply();
	};
	
	$scope.onStart = function(){
		$scope.showStart = false;
		$scope.$broadcast('revUp');
	};
	
	$scope.$on('gameOver',function(event, stats){
		$scope.prevStats = stats;
		$scope.submitGame(stats);
		if(stats.score > $scope.highScores[0].score){
			$scope.message = "Congratulations, your score " + stats.score + " bested " + $scope.highScores[0].userName + "'s score, " + $scope.highScores[0].score + ".";
		}else if(stats.score > $scope.highScores[$scope.highScores.length-1].score){
			$scope.message = "Bummer, a score of " + stats.score + " really wasn't great. Compared to " + $scope.highScores[0].userName + "'s amazing " + $scope.highScores[0].score + " score it is severly lacking. However, feel a bit of joy, you did happen to get on the leaderboard for now.";
		}else{
			$scope.message = "Wow, your score was just horrible, not even worth telling you how bad, cause it was that bad. Maybe next time";
		}
		$scope.showStart = true;
	});
	
	$scope.submitGame = function submitGame(game){
		game.version = version;
		game.userId = $scope.person.id;
		game.userName = $scope.person.displayName;
		game.userImage = $scope.person.image.url;
		game.createDate = new Date();
		$http.post(gamesep,game).success(function submitGameSuccess(data){
			$scope.getLeaderBoard();
		}).error(function submitGameError(data){
			alert("Dag Yo");
		});
	};
	
	$scope.getLeaderBoard = function getLeaderBoard(){
		$http.get(hsep + version).success(function highScoresSuccess(data){
			$scope.highScores = data;
		});
		$http.get(gcep + version).success(function gameCountSuccess(data){
			$scope.gameCount = data;
		});
	};
	
	$scope.getLeaderBoard();
}

function GameController($scope,$window){
	$scope.gameInProgress = false;
	$scope.keys = {space:false,left:false,up:false,right:false,down:false};
	$scope.angleVec = new CANNON.Vec3(0,0,0);
	
	$scope.resetWorld = function(){
		$scope.stats = {score:0, bulletsFired: 0, wave:$scope.gameConfig.startingWave,largeAsteroidsDestroyed:0,mediumAsteroidsDestroyed:0, smallAsteroidsDestroyed:0};
		$scope.health = $scope.gameConfig.startingHealth;
		$scope.asteroids = new Object();
		$scope.asteroids[$scope.gameConfig.asteroidLargeRadius] = new Array();
		$scope.asteroids[$scope.gameConfig.asteroidMediumRadius] = new Array();
		$scope.asteroids[$scope.gameConfig.asteroidSmallRadius] = new Array();
		$scope.bullets = new Array();
		$scope.lastBulletFired = 0;
		$scope.spaceShipMaterial = null;
		$scope.asteroidMaterial = null;
		$scope.bulletMaterial = null;
	};
	
	$scope.$on('revUp', function(event){
		$scope.resetWorld();
		$scope.initializeThree();
		$scope.initializePhysics();
		//Set up animation
		$scope.gameInProgress = true;
		$window.requestAnimationFrame($scope.gameLoop);
	});
	/**
	 * This method will get called outside of the angular framework
	*/
	$scope.onKeyDown = function(event){
		switch(event.keyCode){
			case 32://Space
				$scope.keys.space = true;
				break;
			case 37://Left
				$scope.keys.left = true;
				break;
			case 38://Up
				$scope.keys.up = true;
				break;
			case 39://Right
				$scope.keys.right = true;
				break;
			case 40://Down
				break;
		}
		$scope.$apply();
	};
	/**
	 * This method will get called outside of the angular framework
	*/
	$scope.onKeyUp = function(event){
		switch(event.keyCode){
			case 32:
				$scope.keys.space = false;
				break;
			case 37:
				$scope.keys.left = false;
				break;
			case 38:
				$scope.keys.up = false;
				break;
			case 39:
				$scope.keys.right = false;
				break;
		}
		$scope.$apply();
	};
	
	$window.onkeydown = $scope.onKeyDown;
	$window.onkeyup = $scope.onKeyUp;
	
	$scope.initializeThree = function(){
		// set the scene size
		var WIDTH = 800, HEIGHT = 800;

		// set some camera attributes
		var VIEW_ANGLE = 80, ASPECT = WIDTH / HEIGHT, NEAR = 0.1, FAR = 10000;
		
		var canvas = document.getElementById("canvas");

		// create a WebGL renderer, camera
		// and a scene
		$scope.renderer = new THREE.WebGLRenderer({canvas:canvas});
		$scope.renderer.shadowMapEnabled = true;
		$scope.renderer.shadowMapSoft = true;
		$scope.camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
		$scope.scene = new THREE.Scene();

		// add the camera to the scene
		$scope.scene.add($scope.camera);
		$scope.camera.position.x = 200;
		$scope.camera.position.y = 200;
		$scope.camera.position.z = 250;
		$scope.camera.lookAt(new THREE.Vector3(200, 200, 0));
		
		// create a point light
		var spotLight = new THREE.SpotLight(0xFFFFFF);
		spotLight.shadowCameraFov = 65;
		spotLight.shadowMapWidth = 1024;
		spotLight.shadowMapHeight = 1024;
		spotLight.castShadow = true;
		spotLight.shadowDarkness = 0.5;
		//spotLight.shadowCameraVisible = true;
		// set its position
		spotLight.position.x = -750;
		spotLight.position.y = -750;
		spotLight.position.z = 0;

		// add to the scene
		$scope.scene.add(spotLight);
		
		//Ambient Light
		var ambientLight = new THREE.AmbientLight( 0x303030 ); // soft white light
		$scope.scene.add(ambientLight);

		// start the renderer
		$scope.renderer.setSize(WIDTH, HEIGHT);
	};
	
	$scope.initializePhysics = function(){
		$scope.world = new CANNON.World();
		$scope.world.gravity.set(0,0,0);
		$scope.world.broadphase = new CANNON.NaiveBroadphase();
		
		$scope.spaceShipMaterial = new CANNON.Material("spaceship");
		$scope.asteroidMaterial = new CANNON.Material("asteroid");
		$scope.bulletMaterial = new CANNON.Material("bullet");
		var a_a_cm = new CANNON.ContactMaterial($scope.asteroidMaterial, $scope.asteroidMaterial, 0.75,0.25);
		$scope.world.addContactMaterial(a_a_cm);
		var ss_a_cm = new CANNON.ContactMaterial($scope.spaceShipMaterial,$scope.asteroidMaterial,0.5,0.3);
		$scope.world.addContactMaterial(ss_a_cm);
		var a_b_cm = new CANNON.ContactMaterial($scope.asteroidMaterial, $scope.bulletMaterial,0.01, 0.75);
		$scope.world.addContactMaterial(a_b_cm);
		$scope.spaceShip = $scope.createSpaceShip();
		$scope.world.add($scope.spaceShip);
		if($scope.scene)
			$scope.scene.add($scope.spaceShip.geom);
	};
	
	$scope.spaceShipMaterial = null;
	$scope.createSpaceShip = function createSpaceShip(){
		var spaceShipShape = new CANNON.Box(new CANNON.Vec3(8,4,4));
		var spaceShipBody = new CANNON.RigidBody($scope.gameConfig.spaceShipMass,spaceShipShape,$scope.spaceShipMaterial);
		spaceShipBody.position.set(200,200,0);
		spaceShipBody.linearDamping = $scope.gameConfig.spaceShipLinearDamping;
		spaceShipBody.angularDamping = $scope.gameConfig.spaceShipAngularDamping;
		spaceShipBody.gameType = 1;
		spaceShipBody.marked = false;
		if($scope.scene){
			var spaceShipRenderBody = new THREE.CubeGeometry(8, 4, 4, 1, 1, 1);
			var spaceShipRenderMaterial = new THREE.MeshLambertMaterial({color: 0xFF0000});
			spaceShipRenderMaterial.ambient = new THREE.Color(0xFF0000);
			spaceShipRenderMaterial.emissive = new THREE.Color(0xFF0000);
			spaceShipBody.geom = new THREE.Mesh(spaceShipRenderBody, spaceShipRenderMaterial);
			spaceShipBody.geom.useQuaternion = true;
			spaceShipBody.geom.castShadow = true;
			spaceShipBody.geom.receiveShadow = true;
		}
		return spaceShipBody;
	};
	
	$scope.asteroidMaterial = null;
	$scope.createAsteroid = function createAsteroid(size){
		var asteroidBody = null;
		if($scope.asteroids[size].length > 0){
			asteroidBody = $scope.asteroids[size].pop();
			asteroidBody.velocity.set(0,0,0);
		}else{
			var asteroidShape = new CANNON.Sphere(size);
			var asteroidMass = 0;
			switch(size){
				case $scope.gameConfig.asteroidLargeRadius:
					asteroidMass = $scope.gameConfig.asteroidLargeMass;
					break;
				case $scope.gameConfig.asteroidMediumRadius:
					asteroidMass = $scope.gameConfig.asteroidMediumMass;
					break;
				case $scope.gameConfig.asteroidSmallRadius:
					asteroidMass = $scope.gameConfig.asteroidSmallMass;
					break;
				default:
					asteroidMass = 100;
			}
			asteroidBody = new CANNON.RigidBody(asteroidMass, asteroidShape, $scope.asteroidMaterial);
			asteroidBody.gameType = 3;
			asteroidBody.linearDamping = 0.01;
			asteroidBody.angularDamping = 0.01;
		}
		asteroidBody.marked = false;
		if($scope.scene){
			var asteroidRenderBody = new THREE.SphereGeometry(size);
			var asteroidRenderMaterial = new THREE.MeshLambertMaterial({color: 0x00FF00});
			asteroidRenderMaterial.ambient = new THREE.Color(0x00FF00);
			asteroidBody.geom = new THREE.Mesh(asteroidRenderBody, asteroidRenderMaterial);
			asteroidBody.geom.useQuaternion = true;
			asteroidBody.geom.castShadow = true;
			asteroidBody.geom.receiveShadow = true;
		}
		return asteroidBody;
	};
	
	$scope.bulletMaterial = null;
	$scope.createBullet = function createBullet(){
		var bulletBody = null;
		if($scope.bullets.length > 0){
			bulletBody = $scope.bullets.pop();
		}else{
			var bulletShape = new CANNON.Sphere(1);
			bulletBody = new CANNON.RigidBody(10, bulletShape, $scope.bulletMaterial);
			bulletBody.gameType = 2;
		}
		bulletBody.marked = false;
		bulletBody.linearDamping = 0;
		bulletBody.angularDamping = 0;
		if($scope.scene){
			var bulletRenderBody = new THREE.SphereGeometry(1);
			var bulletRenderMaterial = new THREE.MeshLambertMaterial({color: 0xFFFFFF});
			bulletBody.geom = new THREE.Mesh(bulletRenderBody, bulletRenderMaterial);
			bulletBody.geom.useQuaternion = true;
		}
		return bulletBody;
	};
	
	$scope.gameLoop = function gameLoop(time){
		if($scope.gameInProgress){
			if(! $scope.lastUpdate)
				$scope.lastUpdate = time - (1000 / 60);
			if(! $scope.lastAngularUpdate)
				$scope.lastAngularUpdate = time - 1000;
			//Process User Input
			$scope.processUserInput(time);
			//Step Physics
			$scope.stepPhysics(time);
			//Game Logic
			$scope.gameLogic(time);
			//Draw Scene
			//$scope.render2d(time);
			$scope.render3d(time);
			//Keep track of when I last updated
			$scope.lastUpdate = time;
			//Trigger Angular Updates once a second
			if((time - $scope.lastAngularUpdate) > 1000){
				$scope.$apply();
				$scope.lastAngularUpdate = time;
			}
			//Request to be called again
			window.requestAnimationFrame($scope.gameLoop);
		}
	};
	
	$scope.processUserInput = function processUserInput(time){
		if($scope.keys.up){
			$scope.angleVec.set(1,0,0);
			$scope.spaceShip.quaternion.vmult($scope.angleVec,$scope.angleVec);
			$scope.angleVec.normalize();
			$scope.spaceShip.force.x = $scope.angleVec.x * $scope.gameConfig.spaceShipThrust;
			$scope.spaceShip.force.y = $scope.angleVec.y * $scope.gameConfig.spaceShipThrust;
		}
		if($scope.keys.left){
			$scope.spaceShip.tau.z = $scope.gameConfig.spaceShipTorque;
		}
		if($scope.keys.right){
			$scope.spaceShip.tau.z = -$scope.gameConfig.spaceShipTorque;
		}
		if($scope.keys.space){
			if((time - $scope.lastBulletFired) > $scope.gameConfig.bulletRate){
				$scope.angleVec.set(1,0,0);
				$scope.spaceShip.quaternion.vmult($scope.angleVec,$scope.angleVec);
				bullet = $scope.createBullet();
				bullet.created = time;
				
				//Get position and vel for new bullet
				bullet.position.set($scope.spaceShip.position.x + ($scope.angleVec.x * 10),$scope.spaceShip.position.y + ($scope.angleVec.y * 10),0);
				bullet.velocity.set($scope.spaceShip.velocity.x + ($scope.angleVec.x * $scope.gameConfig.bulletSpeed), $scope.spaceShip.velocity.y + ($scope.angleVec.y * $scope.gameConfig.bulletSpeed),0);
				$scope.world.add(bullet);
				if($scope.scene)
					$scope.scene.add(bullet.geom);
				$scope.lastBulletFired = time;
				$scope.stats.bulletsFired++;
			}
		}
	};
	
	$scope.stepPhysics = function stepPhysics(time){
		//Use the time variable to determine when we last ticked, and use that as the step incrment
		var step = (time - $scope.lastUpdate) / 1000;
		$scope.world.step(step);
		
		//Iterate Contact manifold and mark collisions
		for(var i = 0; i < $scope.world.contacts.length; i++){
			var contact = $scope.world.contacts[i];
			if(contact.bi.gameType == 3){
				if(contact.bj.gameType == 1)
					$scope.health -= $scope.gameConfig.spaceShipAsteroidDamage;
				if(contact.bj.gameType == 2){
					contact.bi.marked = true;
					contact.bj.marked = true;
				}
				/*if(contact.bj.gameType==3 && contact.bj.appeared && time-contact.bj.appeared<100){
					//contact.bj.velocity=contact.rj;
					delete contact.bj.appeared;
					//contact.bi.velocity=contact.ri;
				}*/
			}
			if(contact.bj.gameType == 3){
				if(contact.bi.gameType == 1)
					 $scope.health -= $scope.gameConfig.spaceShipAsteroidDamage;
				if(contact.bi.gameType == 2){
					contact.bj.marked = true;
					contact.bi.marked = true;
				}
				/*if(contact.bi.gameType==3 && contact.bi.appeared && time-contact.bi.appeared<100){
					//contact.bi.velocity=contact.ri;
					delete contact.bi.appeared;
					//contact.bj.velocity=contact.rj;
				}*/
			}
			
		}
		
	};
	
	$scope.gameLogic = function gameLogic(time){
		var asteroidsLeft = 0;	
		//Make sure game objects remain in xy plane and in bounds
		for(var i = 0; i < $scope.world.bodies.length; i++){
			var body = $scope.world.bodies[i];
			body.position.z = 0;
			body.velocity.z = 0;
			body.position.x %= 400;
			/*if(body.position.x >410){
				body.position.x-=420;
				body.appeared=time;
			}*/
			if(body.position.x < 0){
				body.position.x = 400 + body.position.x;
				body.appeared=time;
			}
			body.position.y %= 400;
			/*if(body.position.y>410){
				body.position.y-=420;
				body.appeared=time;
			}*/
			if(body.position.y < 0){
				body.position.y = 400 + body.position.y;
				body.appeared=time;
			}
				
			//Make sure bullets die after a little while;
			if(body.gameType == 2){
				if(body.marked == true || time - body.created > $scope.gameConfig.bulletLife){
					$scope.world.remove(body);
					if($scope.scene)
						$scope.scene.remove(body.geom);
					--i;
					$scope.bullets.push(body);
					continue;
				}
			}
			if(body.gameType == 3){
				if(body.marked == true){
					$scope.world.remove(body);
					if($scope.scene)
						$scope.scene.remove(body.geom);
					--i;
					$scope.breakUpAsteroid(body);
					continue;
				}else{
					asteroidsLeft++;
				}
			}
			if($scope.scene){
				body.position.copy(body.geom.position);
				body.quaternion.copy(body.geom.quaternion);
			}
		}
		
		//Wave ending condition... asteroids are gone
		if(asteroidsLeft == 0){
			$scope.stats.wave++;
			$scope.stats.score += 1736;
			var asteroids=[];
			for(var i = 0; i < $scope.stats.wave; i++){
				var asteroid = $scope.createAsteroid($scope.gameConfig.asteroidLargeRadius);
				do{
					asteroid.position.set(Math.random()*400,Math.random()*400,0);
				}while($scope.doesAsteroidOverlapSafeArea(asteroid,50));
				$scope.doesAsteroidOverlapOtherAsteroid(asteroid,asteroids);
				asteroid.velocity.set(Math.random()*10,Math.random()*10,0);
				//asteroid.velocity.set(1,1,0);
				asteroid.appeared= time;
				asteroids.push(asteroid);
				$scope.world.add(asteroid);
				if($scope.scene)
					$scope.scene.add(asteroid.geom);
			}
			$scope.$apply();
		}
		//Game ending condition... health has expired
		if($scope.health <= 0){
			var stats = $scope.stats;
			$scope.resetWorld();
			$scope.gameInProgress = false;
			$scope.$emit('gameOver',stats);
			$scope.$apply();
		}
		
	};
	
	$scope.doesAsteroidOverlapSafeArea= function doesAsteroidOverlapSafeArea(asteroid, safezone){
		if(asteroid.position.x > $scope.spaceShip.position.x-safezone && asteroid.position.x < $scope.spaceShip.position.x+safezone){
			return true;
		}
		if(asteroid.position.y > $scope.spaceShip.position.y-safezone && asteroid.position.y < $scope.spaceShip.position.y+safezone){
			return true;
		}
		return false;
	};
	
	$scope.doesAsteroidOverlapOtherAsteroid = function doesAsteroidOverlapOtherAsteroid(asteroid,asteroids){
		var attempts =0;
		for(var i=0; i<asteroids.length; i++){
			while((asteroid.position.x > asteroids[i].position.x-$scope.gameConfig.asteroidLargeRadius && asteroid.position.x < asteroids[i].position.x+$scope.gameConfig.asteroidLargeRadius) 
				||(asteroid.position.y > asteroids[i].position.y-$scope.gameConfig.asteroidLargeRadius && asteroid.position.y < asteroids[i].position.y+$scope.gameConfig.asteroidLargeRadius)){
				//reset the position so it and check that it doesn't overlap the spaceship
				do{
					asteroid.position.set(Math.random()*400,Math.random()*400,0);
				}while($scope.doesAsteroidOverlapSafeArea(asteroid,50));
				//set i back to 0 so it loops throught the whole array again.
				i=0;
				attempts++;
				if(attempts>10)
					return;
			}
		}
	};
	
	$scope.breakUpAsteroid = function breakUpAsteroid(asteroid){
		var fragSize = 0;
		var rad = asteroid.shape.radius;
		var posx = asteroid.position.x;
		var posy = asteroid.position.y;
		var velx = asteroid.velocity.x;
		var vely = asteroid.velocity.y;
		switch(rad){
			case $scope.gameConfig.asteroidLargeRadius:
				$scope.asteroids[$scope.gameConfig.asteroidLargeRadius].push(asteroid);
				$scope.stats.largeAsteroidsDestroyed++;
				$scope.stats.score += $scope.gameConfig.asteroidLargePoints;
				fragSize = $scope.gameConfig.asteroidMediumRadius;
				break;
			case $scope.gameConfig.asteroidMediumRadius:
				$scope.asteroids[$scope.gameConfig.asteroidMediumRadius].push(asteroid);
				$scope.stats.mediumAsteroidsDestroyed++;
				$scope.stats.score += $scope.gameConfig.asteroidMediumPoints;
				fragSize = $scope.gameConfig.asteroidSmallRadius;
				break;
			case $scope.gameConfig.asteroidSmallRadius:
				$scope.asteroids[$scope.gameConfig.asteroidSmallRadius].push(asteroid);
				$scope.stats.smallAsteroidsDestroyed++;
				$scope.stats.score += $scope.gameConfig.asteroidSmallPoints;
				return;
		}
		var tl = $scope.createAsteroid(fragSize);
		tl.position.set(posx - (rad/2), posy + (rad/2),0);
		tl.velocity.set(velx + (Math.random() * -$scope.gameConfig.asteroidExplodeVelocity),
			vely + (Math.random() * $scope.gameConfig.asteroidExplodeVelocity), 0);
		var bl = $scope.createAsteroid(fragSize);
		bl.position.set(posx - (rad/2), posy - (rad/2),0);
		bl.velocity.set(velx + (Math.random() * -$scope.gameConfig.asteroidExplodeVelocity),
			vely + (Math.random() * -$scope.gameConfig.asteroidExplodeVelocity), 0);
		var tr = $scope.createAsteroid(fragSize);
		tr.position.set(posx + (rad/2), posy + (rad/2),0);
		tr.velocity.set(velx + (Math.random() * $scope.gameConfig.asteroidExplodeVelocity),
			vely + (Math.random() * $scope.gameConfig.asteroidExplodeVelocity), 0);
		var br = $scope.createAsteroid(fragSize);
		br.position.set(posx + (rad/2), posy - (rad/2),0);
		br.velocity.set(velx + (Math.random() * $scope.gameConfig.asteroidExplodeVelocity),
			vely + (Math.random() * -$scope.gameConfig.asteroidExplodeVelocity), 0);
		$scope.world.add(tl);
		if($scope.scene)
			$scope.scene.add(tl.geom);
		$scope.world.add(bl);
		if($scope.scene)
			$scope.scene.add(bl.geom);
		$scope.world.add(tr);
		if($scope.scene)
			$scope.scene.add(tr.geom);
		$scope.world.add(br);
		if($scope.scene)
			$scope.scene.add(br.geom);
	};
	
	$scope.render2d = function render2d(time){
		var canvas = document.getElementById("canvas");
		var context = canvas.getContext('2d');
		//Clear
		context.clearRect(0,0,canvas.width,canvas.height);
		
		//Draw SpaceShip
		$scope.angleVec.set(1,0,0);
		$scope.spaceShip.quaternion.vmult($scope.angleVec,$scope.angleVec);
		$scope.angleVec.normalize();
		//var dot = $scope.angleVec.dot(new CANNON.Vec3(1,0,0));
		//var angle = Math.acos(dot);
		var frontx = $scope.spaceShip.position.x + ($scope.angleVec.x * 4);
		var fronty = $scope.spaceShip.position.y + ($scope.angleVec.y * 4);
		$scope.angleVec.set(-4,2,0);
		var backmag = $scope.angleVec.norm();
		$scope.spaceShip.quaternion.vmult($scope.angleVec,$scope.angleVec);
		$scope.angleVec.normalize();
		var backupx = $scope.spaceShip.position.x + ($scope.angleVec.x * backmag);
		var backupy = $scope.spaceShip.position.y + ($scope.angleVec.y * backmag);
		$scope.angleVec.set(-4,-2,0);
		$scope.spaceShip.quaternion.vmult($scope.angleVec,$scope.angleVec);
		$scope.angleVec.normalize();
		var backdownx = $scope.spaceShip.position.x + ($scope.angleVec.x * backmag);
		var backdowny = $scope.spaceShip.position.y + ($scope.angleVec.y * backmag);
		
		context.fillStyle = "#FF0000";
		context.strokeStyle = "#00FF00";
		context.moveTo(frontx,fronty);
		context.beginPath();
		context.lineTo(backupx,backupy);
		context.lineTo(backdownx,backdowny);
		context.lineTo(frontx,fronty);
		context.stroke();
		context.fill();
		
		context.fillStyle="#FFFFFF";
		for(var i = 0; i < $scope.world.bodies.length; i++){
			var body = $scope.world.bodies[i];
			if(body.gameType == 2)
				context.fillRect(body.position.x,body.position.y,1,1);
			if(body.gameType == 3){
				context.beginPath();
				context.arc(body.position.x,body.position.y,body.shape.radius,0,2*Math.PI);
				context.stroke();
			}
		}
	};
	
	$scope.render3d = function render3d(time){
		$scope.renderer.render($scope.scene, $scope.camera);
	};
	
	$scope.onClickGameWorld = function(){
		//$scope.score += 1000;
	};
}
