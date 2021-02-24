var renderedProgram = document.getElementById('renderedProgram');
var programData = null;
var theTemplateScript = $("#program-template").html();
var theTemplate = Handlebars.compile(theTemplateScript);

/**
* Set utc and local starttime and endtime on each session. tz is the IANA timezone name (e.g.,
* UTC or America/Los_Angeles) for all times in the program.
*
* each timeslot has four new times added:
* - utcstarttime (e.g., Wed Dec 7, 14:30)
* - utcendtime
* - localstarttime
* - localendtime
*
* The timeslot also gets an id which is localendtime in millis since 1970.
* Each day also gets a "localdate" to indicate what date it is in the time zone of the user.
*/
function adjustTimes(tz, day) {
  if (!day.hasOwnProperty('timeslots') || !day.timeslots.length) {
    console.log('day without timeslots:' + day.date);
    return;
  }
  let date = '';
  for (let j = 0; j < day['timeslots'].length; j++) {
    let timeslot = day['timeslots'][j];
    // Note that starttime and endtime could be '7:00' without leading 0, so we use
    // padStart to add leading 0 if necessary.
    startstr = day.date + 'T' + timeslot.starttime.padStart(5, '0') + ':00';
    let starttime = DateTime.fromISO(startstr, {zone: tz.name});
    let endtime = DateTime.fromISO(day.date + 'T' + timeslot.endtime.padStart(5, '0') + ':00',
                                   {zone: tz.name});
    timeslot.utcstarttime = starttime.setZone('UTC').toFormat('ccc LLL d HH:mm');
    timeslot.utcendtime = endtime.setZone('UTC').toFormat('ccc LLL d HH:mm');
    timeslot.localstarttime = starttime.setZone('local').toFormat('ccc LLL d HH:mm');
    if (j === 0) {
      date = starttime.setZone('local').toFormat('ccc LLL d');
    }
    let localendtime = endtime.setZone('local');
    timeslot.id = localendtime.toMillis();
    timeslot.localendtime = localendtime.toFormat('ccc LLL d HH:mm');
  }
  day.localdate = date;
}

// The id of a timeslot is the timestamp of the endtime. We go
// through the sessions until we find the one that is either going on now or
// is next to start. That would be the one with the lowest endtime >= now.
function scrollToSession() {
  if (!programData) {
    return;
  }
  let now = DateTime.local().toMillis();
  // lastid will be the smallest id of a timeslot that is >= now.
  let lastid = undefined;
  for (let dayi = programData.days.length - 1; dayi >=0; dayi--) {
    let day = programData.days[dayi];
    for (let timesloti = day.timeslots.length - 1; timesloti >= 0; timesloti--) {
      if (now <= day.timeslots[timesloti].id) {
        lastid = String(day.timeslots[timesloti].id);
      } else {
        break;
      }
    }
  }
  if (lastid) {
    let elem = document.getElementById(lastid);
    if (elem) {
      elem.scrollIntoView({behavior: "smooth"});
      document.getElementById('scrollSessionButton').style.display = 'block';
    } else {
      console.log('unknown elem:' + lastid);
    }
  } else {
    console.log('no lastid');
  }
}

function drawProgram() {
  /* Every timeslot gets a tabbedSessions variable when
     it is drawn, to detect which ones should use tabs. */
  var days = programData['days'];
  for (var i = 0; i < days.length; i++) {
    var timeslots = days[i]['timeslots'];
    for (var j = 0; j < timeslots.length; j++) {
      let timeslot = timeslots[j];
      if (timeslot['sessions'].length > 2 ||
          (timeslot['sessions'].length == 2 && programData['isNarrow'])) {
        timeslot['tabbedSessions'] = true;
      } else {
        timeslot['tabbedSessions'] = false;
      }
    }
  }
  renderedProgram.innerHTML = theTemplate(programData);
  document.querySelectorAll("[data-toggle='collapse']").forEach(item => {
    item.addEventListener("click", event => {
      let node = event.target;
      if (node.classList.contains('toggle-closed')) {
        node.classList.remove('toggle-closed');
        node.classList.add('toggle-open');
        node.text = 'Hide abstract';
      } else {
        node.classList.add('toggle-closed');
        node.classList.remove('toggle-open');
        node.text = 'Show abstract';
      }
    });
  });
}
  
$(document).ready(function() {
    // We watch this to determine when parallel tracks should be
    // drawn with tabs.
    var narrowWindow = window.matchMedia("(max-width: 990px)");
  
    // set up Handlebars helper to display dates with day of the week
    Handlebars.registerHelper('formatDate', function(isodate) {
	var parts = isodate.split('-');
	return new Date(parts[0],
			parts[1] - 1, // months are zero-based
			parts[2]).toLocaleString('en-US', {weekday: "short", month: "short", day: "numeric"});
    });

    Handlebars.registerHelper('addOne', function(ind, opts) {
        return parseInt(ind) + 1;
    });
  // This allows any number of parallel sessions by setting the class on them
  // to depend on the number of sessions. We may wish to adjust how things
  // look depending on the content in a session.
  Handlebars.registerHelper('sessionClass', function(sessionList) {
    let base = 'session-' + sessionList.length;
    switch(sessionList.length) {
      case 0:
      case 1:
        return base + ' col-12';
      case 2:
        return base + ' col-12 col-md-6';
      case 3:
        return base + ' col-12 col-md-6';
      case 4:
        return base + ' col-12 col-md-6';
      default:
        return base + ' col-12'
    }
  });

  $.ajax({
    cache: false,
    url: './program.json', // json/program.json',
    dataType: 'json',
    success: function(data) {
      if (!data.hasOwnProperty('days')) {
        renderedProgram.innerHTML = '<p>The conference program is not currently available. Please check back later.</p>';
        return;
      }

      if (!data.config.hasOwnProperty('timezone')) {
        // set to UTC by default.
        data.config['timezone'] = {'name': 'UTC', 'abbr': 'UTC'};
      } else if(data.config.timezone.name === 'Universal Time') {
          // This was an old usage of name.
          data.config.timezone.name = 'UTC';
      }
      var days = data['days'];
      for (var i = 0; i < days.length; i++) {
        adjustTimes(data.config.timezone, days[i]);
        var timeslots = days[i]['timeslots'];
        for (var j = 0; j < timeslots.length; j++) {
          if(timeslots[j]['sessions'].length > 1) {
            timeslots[j]['twosessions'] = true;
          }
        }
      }
      data['isNarrow'] = narrowWindow.matches;
      programData = data;
      narrowWindow.addListener(function(e) {
        console.log('watcher');
        console.dir(e);
        programData['isNarrow'] = e.matches;
        drawProgram();
      });
      drawProgram();
    },
    fail: function(jqxhr, textStatus, error) {
      document.getElementById('renderedProgram');
      renderedProgram.innerHTML = '<p>The conference program is not currently available. Please check back later.</p>';

      if (textStatus === 'error') {
        console.log('program.json not found, check file name and try again');
      } else {
        console.log('There is a problem with program.json. The problem is ' + error);
      }
    }
  });
});
