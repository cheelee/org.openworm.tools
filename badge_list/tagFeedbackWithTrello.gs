/*
Author: cheelee@openworm.org
Created: 6/6/2017
Updated: 6/13/2017

Timed script that probes the Badge List interface to gather
  list of users with outstanding badge feedback requests.
  
New ones are added to our Community Trello Board as cards.

For consistency reasons, we will punt every time we do not
  get an "OK" HTTP response of 200.
*/

// Organization-specific Trello keys and ids.
var trelloListId = 'stub';
var trelloAppKey = 'stub';
var trelloToken = 'stub';
var trelloMembersIdList = 'stub0,stub1,stub2';

// *CWL* NOTE: Current code base specific to OpenWorm, and points
//   directly to OpenWorm's Badge List setup.

function checkBadgeFeedback() {
  try {
    var newCardAdded = false;
    var trelloCardList = getExistingTrelloCards();
    var badgeListUrl = "https://www.badgelist.com";
    var owMainBadgeUrl = badgeListUrl + "/OpenWorm.json";
    var owMainBadgeText = testAndFetchUrl(owMainBadgeUrl).getContentText();
    var owBadgeData = JSON.parse(owMainBadgeText);
    var listOfBadges = owBadgeData.badges;
    // Loop through all badges ("badges")
    for (var badgeIdx=0; badgeIdx<listOfBadges.length; badgeIdx++) {
      var badgeUrl = owMainBadgeUrl.slice(0,-5) + "/" + listOfBadges[badgeIdx] + ".json";
      var badgeText = testAndFetchUrl(badgeUrl).getContentText();
      var badgeData = JSON.parse(badgeText);
      var listOfLearners = badgeData.learners;
      // Loop through all learners ("learners")
      for (var learnerIdx=0; learnerIdx<listOfLearners.length; learnerIdx++) {
        var learnerUrl = badgeUrl.slice(0,-5) + "/u/" + listOfLearners[learnerIdx] + ".json";
        var learnerText = testAndFetchUrl(learnerUrl).getContentText();
        var learnerData = JSON.parse(learnerText);
        if (learnerData.validation_status == "requested") {
          var learnerProfileUrl = badgeListUrl + "/u/" + listOfLearners[learnerIdx] + ".json";
          var learnerProfileText = testAndFetchUrl(learnerProfileUrl).getContentText();
          var learnerProfileData = JSON.parse(learnerProfileText);
          var learnerName = learnerProfileData.name;
          var badgeFeedbackUrl = learnerUrl.slice(0,-5);
          if (isFeedbackNew(trelloCardList, badgeFeedbackUrl)) {
            sendTrelloCard(learnerName, badgeFeedbackUrl);
            Logger.log("New card added: " + learnerName + " " + badgeFeedbackUrl);
            newCardAdded = true;
          }
        }
      }
    }
    if (!newCardAdded) {
      Logger.log("Script Successfully completed - no new cards added.");
    }
  } catch(err) {
    Logger.log('Error [' + err + '] caught, giving up checkBadgeFeedback');
    return;
  }
}

function testAndFetchUrl(url, options) {
  var response;
  if (options === undefined) {
    // options was not passed in
    response = UrlFetchApp.fetch(url);
  } else {
    response = UrlFetchApp.fetch(url, options);
  }
  var code = response.getResponseCode()
  if (code != 200) {
    throw 'Fetch Error code: ' + code + ' on URL: ' + url;
  } else {
    return response;
  }
}

var badgeDescPrefix = "Badge Link: ";


// *CWL* NOTE - This is fairly fragile, and assumes some restrictive
//   (but reasonable) user-level protocol for dealing with outstanding 
//   feedback requests. For example moving an outstanding feedback
//   request card from "Todo" to "In Progress" would cause the script
//   to pop another alert if the feedback request has not actually
//   been taken care of on Badge List. This should probably be handled
//   in the future, e.g. in the scenario where the evidence is insufficient
//   and further action is required, in which case "In Progress" is a good
//   place to put the card.
function getExistingTrelloCards() {
  var query = 'fields=desc'
  var url = 'https://api.trello.com/1/lists/' + trelloListId + '/cards?' + query +
    '&key=' + trelloAppKey + '&token=' + trelloToken;
  var options = {"method": "get"};
  var queryText = testAndFetchUrl(url, options);
  var queryData = JSON.parse(queryText);
  var returnList = [];
  for (var i=0; i<queryData.length; i++) {
    var queryDesc = queryData[i]['desc'];
    if (queryDesc.lastIndexOf(badgeDescPrefix, 0) == 0) {
      returnList.push(queryDesc.slice(badgeDescPrefix.length));
    }
  }
  return returnList;
}

function isFeedbackNew(cardList, badgeUrl) {
  var returnVal = true;
  for (var i=0; i<cardList.length; i++) {
    if (cardList[i] == badgeUrl) {
      returnVal = false;
    }
  }
  return returnVal;
}

function sendTrelloCard(user, badgeUrl) {
  // POST [/1/cards], Required permissions: write
  // idMembers == list of people who will get bugged by the system for action :)
  var payload = {"name":"Badge Feedback Requested: " + user,
                 "desc":badgeDescPrefix + badgeUrl,
                 "pos":"top", //(optional) Default: bottom Valid Values: A position. top, bottom, or a positive number.
                 "due": "",   //(required) Valid Values: A date, or null
                 "idList": trelloListId, //(required)Valid Values: id of the list that the card should be added to
                 //"labels": ,//(optional)
                 "idMembers": trelloMembersIdList,//(optional)Valid Values: A comma-separated list of objectIds, 24-character hex strings
                 };

   // Because payload is a JavaScript object, it will be interpreted as
   // an HTML form. (We do not need to specify contentType; it will
   // automatically default to either 'application/x-www-form-urlencoded'
   // or 'multipart/form-data')
   var url = 'https://api.trello.com/1/cards?key=' + trelloAppKey + '&token=' + trelloToken;
   var options = {"method" : "post",
                  "payload" : payload};

   testAndFetchUrl(url, options);
 }
