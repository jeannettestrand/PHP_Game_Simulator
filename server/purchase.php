<php

require_once('database.php');
require_once('redis-test.php');

//error_log("starting purchase-----------------");

$id = $_REQUEST["id"];
$iid = $_REQUEST["iid"];

$itemData = [];

//--------------------------------------------------------
//		Get Collection items
//--------------------------------------------------------

$key = "collection.items.$iid";
if ($redis->exists($key)) {
	$itemData = $redis->get($key);
}
else {

	$sql = 'SELECT * FROM collection_items where id = ' . $iid;
	$retval = $conn->query( $sql );
	if(! $retval )
	{	
		$m = "Could not retrieve item data: " . $conn->error;
        	error_log($m);
		die('{"status":"error", "message":"' . $m . '"}');
	}

	if ($row = $retval->fetch_assoc())
	{
		$itemData["id"] = $row["id"];
		$itemData["url"] = $row["image_url"];
		$itemData["cost"] = $row["cost"];
	}
	else
	{
		$m = "Item $iid does not exist: " . $conn->error;
        	error_log($m);
		die('{"status":"error", "message":"' . $m . '"}');
	}
	$redis->set($key, $itemData);
}


//----------------------------------------------------------------------------------------------
//              Get User Collection items for user id
//----------------------------------------------------------------------------------------------
$purchaseData = ["item_id"=>$iid, "count"=>1];

$purchaseDataHistory = [];
		
$firstPurchase = true;
$itemPurchased = false;

$sql = "SELECT * FROM user_collection_items_denorm where user_id = $id";
$retval = $conn->query($sql);
if(! $retval ) {	
	$m = "Could not retrieve user item data: " . $conn->error;
        error_log($m);
	die('{"status":"error", "message":"' . $m . '"}');
}

if ($retval->field_count > 0) 
{	
	$firstPurchase = false;
	if ($row = $retval->fetch_assoc()) 
	{
		$purchaseDataHistory = json_decode($row["data"], true);
		foreach($purchaseDataHistory as $item) 
		{
			if ($iid == $item['item_id']) 
			{
				// Item has been purchased, so we INCREMENT the existing count
				$itemPurchased = true;
				$item["count"] += 1;
				break;
			}

		}
		if ($itemPurchased) 
		{
			// The first time this item is purchased, so we APPEND it to the purchase history.
			$purchaseDataHistory[] = $purchaseData;
		}
	}
}

$encodePurchaseData = ($firstPurchase) ?  json_encode($purchaseData) : json_encode($purchaseDataHistory) ;

$sql = "INSERT INTO user_collection_items_denorm (user_id, data) VALUES ($id, '" . $encodePurchaseData . "') ON DUPLICATE KEY UPDATE data = '" .  $encodePurchaseData . "'";

$retval = $conn->query($sql);
if (! $retval )
{
	$m = "Could not set user collection item count: " . $conn->error;
        error_log($m);
	die('{"status":"error", "message":"' . $m . '"}');
}


// ------------------------------------------------------------------------------------------------------------


$sql = "UPDATE users SET coins=coins-" . strval($itemData['cost']) . " WHERE id=$id";
$retval = $conn->query($sql);
if (! $retval ) {
	$m = "Could not set user coin balance: " . $conn->error;
        error_log($m);
	die('{"status":"error", "message":"' . $m . '"}');
}


//-------------------------------------------------------------------------------------------------------------

echo '{"item_data":' . json_encode($itemData) . ', "item_count":' . $purchaseData["count"] . '}';

$conn->close();
?>

