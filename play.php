<?php

require_once('database.php');
require_once('redis-test.php');

$id = $_REQUEST["id"];
$gid = $_REQUEST["gid"];
$bet = $_REQUEST["bet"];

//----------------------------------
//	WP from GAME DATA
//----------------------------------
//

$key = "game.data.$gid";
$gameData = [];
if ( $redis->exists($key)) 
{
	$gameData = $redis->get($key);
} 
else 
{	
	$sql = "SELECT * FROM game_data_denorm WHERE game_id= $gid";
	$retval = $conn->query($sql);
	if(! $retval )
	{
		$m = "Could not retrieve wp from game_data: " . $conn->error;
		error_log($m);
		die('{"status":"error", "message":"'. $m . '" }');
	}
	if ($row = $retval->fetch_assoc()) {
		$gameData = json_decode($row["data"], true);
	}
	$redis->set($key, $gameData);
}
$wp = floatval($gameData["wp"]);


// ---------------------------------------------------------------------------------------
//		USER_GAME_DATA
//----------------------------------------------------------------------------------------
// Fetch all the user_game k,v associated with user_id and game_id
//
$userGameData = [];
$USGkey = "user.game.data.$id.$gid";

if ($redis->exists($key))
{
	$userGameData = $redis->get($USGkey);
	// NOTE: redis is set at end of this file
}
else 
{
	$sql = "SELECT * FROM user_game_data_denorm WHERE user_id = $id AND game_id = $gid";
	$retval = $conn->query( $sql);
	if(! $retval )
	{		
		$m = "Could not retrieve from user_game_data: " . $conn->error;
        	error_log($m);
		die('{"status":"error", "message":"' . $m . '"}');
	}
	if ($row=$retval->fetch_assoc()) 
	{
		$userGameData = json_decode($row["data"], true);
	} 
}

$win_count = 0;
$lose_count = 0;
$win_total = 0;
$lose_total = 0;
if (array_key_exists("win_total", $userGameData) || array_key_exists("win_count", $userGameData))
{
	$win_count = intval($userGameData["win_count"]);
	$lose_count = intval($userGameData["lose_count"]);
	$win_total = intval($userGameData["win_total"]);
	$lose_total = intval($userGameData["lose_total"]);
} 
else 
{
	$userGameData["win_count"] = strval($win_count);
	$userGameData["lose_count"] = strval($lose_count);
	$userGameData["win_total"]= strval($win_total);
	$userGameData["lose_total"] = strval($lose_total);
}	

//-----------------------------------------------------------------------------------------
// Update coins, xp, level
//
$delta_coins = (rand()/getrandmax() < $wp/2) ? $bet : -$bet;
$delta_xp = intval($bet);
$delta_level = (rand()/getrandmax() < 0.005) ? 1 : 0; // level-up 1 in 200 plays on average

if ($delta_coins > 0) // T= game win, F = game lose
{
	$count_key = "win_count";
	$total_key = "win_total";
	$count_value = $win_count + 1; 			// number of times player played
	$total_value = $win_total + $delta_coins; 	// number of coins after gain
}
else
{
	$count_key = "lose_count";
	$total_key = "lose_total";
	$count_value = $lose_count + 1;			// number of times player played game
	$total_value = $lose_total - $delta_coins;	// number of coins after loss
}

$userGameData[$count_key] = $count_value;
$userGameData[$total_key] = $total_value;
$userGameData['last_play'] = strval(date('d-m-Y'));

//-----------------------------------
// Update Denorm_DB
//----------------------------------

$encodeUserGameData = json_encode($userGameData);

$sql = "UPDATE user_game_data_denorm SET data='" . $encodeUserGameData. "' WHERE user_id = $id AND game_id = $gid";

$retval = $conn->query($sql);
if (! $retval )
{
        $m = "Could not update user_game_data_denorm: " . $conn->error;
        error_log($m);
        die('{"status":"error", "message":"' . $m . '"}');
}

$redis->set($USGkey, $userGameData);

$result = [];

$result["status"] = "success";
$result["delta_coins"] = $delta_coins;
$result["delta_xp"] = $delta_xp;
$result["delta_level"] = $delta_level;


echo json_encode($result);
$conn->close();
?>

