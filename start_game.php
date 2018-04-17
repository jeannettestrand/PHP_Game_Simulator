<?php

require_once('database.php');
require_once('redis-test.php');

$id = $_REQUEST["id"];
$gid = $_REQUEST["gid"];


//----------------------------------
//	GAME_DATA 
//----------------------------------
//
//DB CALL: retrieve all key and value pairs associated with $gid from game_data
//
$gameData = []; // CACHED GAME DATA, includes wp

$key = "game.data.$gid";
if ($redis->exists($key)) 
{
	$gameData = $redis->get($key);
	//redis is set at end of file
}
else 
{
	$sql = "SELECT * FROM game_data_denorm WHERE game_id = $gid";
	$retval = $conn->query( $sql );
	if(! $retval )
	{	
		$m = "Could not retrieve game data: " . $conn->error;
		error_log($m);
		die('{"status":"error", "message":"' . $m . '"}');
	}
	if ($row = $retval->fetch_assoc())
	{
		$gameData = json_decode($row["data"], true);
		$redis->set($key, $gameData);
	}
}
//Remove WP from data returned to client.

$returnGameData = []; //GAME DATA RETURNED TO PIGGIE, excludes wp

foreach ($gameData as $item) 
{
	if ($item[0] != 'wp') // CHECK FOR WP KEY
	{
		$returnGameData[] = $item;;
	}
}	

//-----------------------------------
//	USER_GAME_DATA
//-----------------------------------
//
//DB CALL: retrieve all user_game_data rows associated with a user_id and a game_id
//
$userGameData = [];
$userGameData["sessions"]=0;

$key = "user.game.data.$id.$gid";
if ($redis->exists($key))
{
	$userGameData = $redis->get($key);
	//REDIS USER GAME DATA IS SET AT END OF FILE 
}
else
{	
	$sql = "SELECT * FROM user_game_data_denorm WHERE game_id = $gid AND user_id = $id";
	$retval = $conn->query($sql);
	if(! $retval )
	{		
		$m = "Could not retrieve user game data: " . $conn->error;
        error_log($m);
		die('{"status":"error", "message":"' . $m . '"}');
	}
	if ($row=$retval->fetch_assoc())
	{
		$userGameData = json_decode($row["data"]);
	}
}
$userGameData["sessions"]+=1;
if ($userGameData["sessions"] == 1) // The first time user has played the game
{
	$userGameData["last_play"] = strval(date('d-m-Y'));
	$userGameData["win_count"] = 0;
	$userGameData["win_total"] = 0;
	$userGameData["lose_count"] = 0;
	$userGameData["lose_total"] = 0;	
}

$encodeUserGameData = json_encode($userGameData);
$sql = "INSERT INTO user_game_data_denorm (user_id, game_id, data) VALUES ($id, $gid, ' " . $encodeUserGameData ." ') ON DUPLICATE KEY UPDATE data = ' " . $encodeUserGameData . "'";


$retval = $conn->query($sql);
if (! $retval )
{
	$m = "Could not update user game session count: " . $conn->error;
       	error_log($m);
	die('{"status":"error", "message":"' . $m . '"}');
}

$redis->set($key, $userGameData);

// dbUpdate is already encoded, so we use that instead of encoding again.
echo '{"game_data":' . json_encode($returnGameData) . ', "user_game_data":' . $encodeUserGameData . '}';

$conn->close();
?>

