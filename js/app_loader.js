// ################
// Global variables
// ################

var mqtt;
var reconnectTimeout = 2000;
var topics = [];

var pages = {};
var active_page = {};

var stations = [];

var sensors = [];
var sensor_headers = {
  name: "Name",
  light: "Light",
  temp: "Temperature",
  humi: "Humidity",
  vsol: "Solar Cell Voltage",
  vbat: "Battery Voltage",
  moved: "Movement",
  lowbat: "Battery Low",
  action: "Action Executed",
};


// ##############
// MQTT functions
// ##############

function MQTTconnect() {
    if (typeof path == "undefined") {
      path = '/mqtt';
    }
    mqtt = new Paho.MQTT.Client(
        host,
        port,
        path,
        "web_" + parseInt(Math.random() * 100, 10)
    );
    var options = {
        timeout: 3,
        useSSL: useTLS,
        cleanSession: cleansession,
        onSuccess: onConnect,
        onFailure: function (message) {
            //$('#status').val("Connection failed: " + message.errorMessage + "Retrying");
            setTimeout(MQTTconnect, reconnectTimeout);
        }
    };

    mqtt.onConnectionLost = onConnectionLost;
    mqtt.onMessageArrived = onMessageArrived;

    if (username != null) {
        options.userName = username;
        options.password = password;
    }
    console.log("Host="+ host + ", port=" + port + ", path=" + path + " TLS = " + useTLS + " username=" + username + " password=" + password);
    mqtt.connect(options);
}

function onConnect() {
    updateStatus(true, 'Connected to ' + host);
    render(decodeURI(window.location.hash));
}

function onConnectionLost(response) {
    setTimeout(MQTTconnect, reconnectTimeout);
    updateStatus(false, 'Not connected');
    //$('#status').val("connection lost: " + responseObject.errorMessage + ". Reconnecting");

};


function onMessageArrived(message) {

  var topic = message.destinationName;
  var payload = message.payloadString;

  console.log("MQTT Message: " + topic + " " + payload);
  topic = topic.replace(/\//g, '-');

  active_page['onMessageArrived'](topic, payload);

};


function updateStatus(state, text) {
  var server_status = document.getElementById('server_status');
  if (state) {
    server_status.classList.remove('logo-red');
    server_status.classList.add('logo-green');
  } else {
    server_status.classList.remove('logo-green');
    server_status.classList.add('logo-red');
  }
  //server_status.innerHTML = text;
};


$(document).ready(function() {
    drawNav();
    MQTTconnect();
});

$(window).on('hashchange', function(){
  render(decodeURI(window.location.hash));
});



// Navigation

function drawNav() {
  var nav_elements = [
    [ "#public_transport", "Public Transport" ],
    [ "#buttons", "Buttons!" ],
    [ "#uv_exposer", "UV Exposure Timer" ],
    [ "#smartmeter", "Smartmeter" ],
    [ "#sensors", "Sensors" ],
  ];

  var nav_bar = document.createElement("NAV");
  nav_bar.classList.add('navbar', 'navbar-fixed-top', 'navbar-inverse');
  nav_bar.id = 'nav_bar';

  var nav_container = document.createElement("DIV");
  nav_container.classList.add('container-fluid');
  nav_container.id = 'nav_container';

  var nav_header = document.createElement("DIV");
  nav_header.classList.add('navbar-header');
  nav_header.id = 'nav_header';

  var nav_collapse = document.createElement("DIV");
  nav_collapse.classList.add('collapse', 'navbar-collapse');
  nav_collapse.id = 'nav_collapse';

  var nav_list = document.createElement("UL");
  nav_list.classList.add('nav', 'navbar-nav');
  nav_list.id = 'nav_list';

  var nav = document.getElementById('nav');
  nav.appendChild(nav_bar);
  nav_bar.appendChild(nav_container);
  nav_container.appendChild(nav_header);
  nav_container.appendChild(nav_collapse);
  nav_collapse.appendChild(nav_list);

  $('#nav_header').prepend(' <button type="button" class="navbar-toggle" data-toggle="collapse" data-target="#nav_collapse"> <span class="icon-bar"></span> <span class="icon-bar"></span> <span class="icon-bar"></span>                        </button> <a class="navbar-brand" href="#"> <span id="server_status" class="logo-red" aria-hidden="true">MyWSAN</span></a>');

$('.navbar-collapse').click('li', function() {
  $('.navbar-collapse').collapse('hide');
});

  for (index = 0; index < nav_elements.length; index++) {
    var nav_element_id = nav_elements[index][0];
    nav_element_id = nav_element_id.replace(/\//g, '-');
    $('#nav_list').append('<li class="nav-item"><a class="nav-link" id="' + nav_element_id + '" href="' + nav_elements[index][0]+ '">' + nav_elements[index][1] + '</a></li>');
  }

};



function render(url) {
  
  // unsubscribe all topics and clear topic array
  topics.forEach(function(el, i, array) {
    mqtt.unsubscribe(el, {});
  });
  topics = []

  // Get the keyword from the url.
  var temp = url.split('/')[0];

  // Hide whatever page is currently shown.
  $('.main-content .page').removeClass('visible');

  $('#content').addClass('container');
  var map = {

    '': function() {
      active_page['onMessageArrived'] = function(topic, payload) {
        updateHomepage(topic, payload);
      };
      renderHomepage();
    },
    '#public_transport': function() {
      active_page['onMessageArrived'] = function(topic, payload) {
        updatePublicTransport(topic, payload);
      };
      renderPublicTransport();
    },
    '#buttons': function() {
      active_page['onMessageArrived'] = function(topic, payload) {
        updateButton(topic, payload);
      };
      renderButtons();
    },
    '#uv_exposer': function() {
      active_page['onMessageArrived'] = function(topic, payload) {
        updateUVExposer(topic, payload);
      };
      renderUVExposer();
    },
    '#sensors': function() {
      active_page['onMessageArrived'] = function(topic, payload) {
        updateSensors(topic, payload);
      };
      renderSensors();
    },
  };

  
  // Execute the needed function depending on the url keyword (stored in temp).
  if(map[temp]){
    map[temp]();
  }
  // If the keyword isn't listed in the above - render the error page.
  else {
    renderErrorPage();
  }

};


function updateUVExposer(topic, payload){
};

function updateHomepage(topic, payload) {
};

function renderHomepage() {
  $('#home_div').addClass('visible');
};

function renderPublicTransport() {
  mqtt.subscribe('WEB/public_transport/#', {qos: 0});
  topics.push('WEB/public_transport/#');
  loadStations();
  if (!pages['stations']) {
    drawStations();
    pages['stations'] = 1;
  }
  $('#pubtrans_div').addClass('visible');
  updateAllStations();
};

function renderButtons() {
  mqtt.subscribe('raw/RF12/socket/#', {qos: 0});
  topics.push('raw/RF12/socket/#');
  mqtt.subscribe('raw/RF12/sensornode/#', {qos: 0});
  topics.push('raw/RF12/sensornode/#');
/*
  mqtt.subscribe('home/+/+/+/#', {qos: 0});
  topics.push('home/+/+/+/#');
*/
  if (!pages['buttons']) {
    drawButtons();
    pages['buttons'] = 1;
  }
  $('#buttons_div').addClass('visible');
};

function renderUVExposer() {
  mqtt.subscribe('raw/RF12/socket/#', {qos: 0});
  topics.push('raw/RF12/socket/#');
  if (!pages['exposer']) {
    drawExposer();
    pages['exposer'] = 1;
  }
  $('#uvexposer_div').addClass('visible');
};

function renderSensors() {
  mqtt.subscribe('raw/RF12/sensornode/#', {qos: 0});
  topics.push('raw/RF12/sensornode/#');
  if (!pages['sensors']) {
    drawSensorPage();
    pages['sensors'] = 1;
  }
  $('#sensor_div').addClass('visible');
};

function renderErrorPage() {
  if (!pages['error']) {
    $('#error_div').html('<h1>Well, fuck.</h1>');
    pages['error'] = 1;
  }
  $('#error_div').addClass('visible');
};


// ##########################
// public transport functions
// ##########################

function loadStations() {
  if (localStorage.getItem('stations')) {
    stations = JSON.parse(localStorage.getItem('stations'));
  }
}

function saveStations() {
  localStorage.setItem('stations', JSON.stringify(stations));
}


function updateStation(topic, payload) {
  topic = topic.replace(/-/g, '/');
  var real_payload = new String;
  real_payload = payload;
  mqtt.send(topic, real_payload);
};


function drawStations() {
  var main_div = document.getElementById('content');

  var old = document.getElementById('pubtrans_div');
  if (old) {
    main_div.removeChild(old);
  }


  var dep_div = document.createElement("DIV");
  dep_div.setAttribute("id", "pubtrans_div");
  dep_div.classList.add('page');

  var dep_table = document.createElement("TABLE");
  dep_table.setAttribute("id", "departures");
  dep_table.classList.add('table', 'table-striped');

  stations.forEach(function(station){

    var click_payload = JSON.stringify(station);

    var header = document.createElement("THEAD");
    var header_row = document.createElement("TR");
    var header_cell_name = document.createElement("TH");
    var header_div_name = document.createElement("DIV");
    header_div_name.classList.add('buttonlike');
    var header_text = document.createTextNode(station.name);

    var header_cell_update = document.createElement("TH");
    var header_cell_delete = document.createElement("TH");
    var body = document.createElement("TBODY");

    var update_button = document.createElement("BUTTON");
    update_button.id = 'public_transpoort_update-' + station.name;
    update_button.innerHTML = 'Update';
    update_button.classList.add('button', 'Update');
    update_button.onclick = function(){ updateStation('WEB-public_transport-get', click_payload);};

    var delete_button = document.createElement("BUTTON");
    delete_button.id = 'public_transpoort_delete-' + station.name;
    delete_button.innerHTML = 'Delete';
    delete_button.classList.add('button', 'Delete');
    delete_button.onclick = function(){ deleteStation(station);};

    header_div_name.appendChild(header_text);
    header_cell_name.appendChild(header_div_name);

    header_cell_update.appendChild(update_button);
    header_cell_delete.appendChild(delete_button);

    header_row.appendChild(header_cell_name);
    header_row.appendChild(header_cell_update);
    header_row.appendChild(header_cell_delete);

    header.appendChild(header_row);
    dep_table.appendChild(header);
    dep_table.appendChild(body);

    for (i=0; i < station.display_lines; i++) {
      var dep_row = document.createElement("TR");
      dep_row.setAttribute("id", station.name + '-' + i);
      body.appendChild(dep_row);
    }
  });

  dep_div.appendChild(dep_table);
  main_div.appendChild(dep_div);
  drawInputForm();

  saveStations();

};

function addStation() {
  var sta = document.getElementById('sta_name');
  var dl = document.getElementById('display_lines');
  var to = document.getElementById('time_offset');
  
  stations.push({name: sta.value || 'Königstraße', display_lines: dl.value || 4, time_offset: to.value || 6});
  drawStations();
  $('#pubtrans_div').addClass('visible');
  updateAllStations();
};

function drawInputForm() {
  var form = document.createElement('FORM');
  form.innerHTML = ' <input type="text" id="sta_name" placeholder="Station Name"></input> <input type="text" id="display_lines" placeholder="Number of results"></input> <input type="text" id="time_offset" placeholder="Time offset"></input> <button onclick="addStation()">Add</button>';
  pt_el = document.getElementById('pubtrans_div');
  if (pt_el) {
    pt_el.appendChild(form)
  }
};

function deleteStation(station) {
  var filtered = stations.filter(function(el) {
    return (el != station);
  });
  stations = filtered;
  drawStations();
  $('#pubtrans_div').addClass('visible');
  updateAllStations();

};

function updateAllStations() {
    stations.forEach(function(station){
      var click_payload = JSON.stringify(station);
      updateStation('WEB-public_transport-get', click_payload);
    });
};


function updatePublicTransport(topic, payload) {
  var p = JSON.parse(payload);
  var station = p.station;
  var index = p.index;

  var transport_el = document.getElementById(station + '-' + index);
  if (transport_el) {
    if (p.delay) {
      transport_el.innerHTML = '<tr><td><img src="' + p.line_pic + '"></td><td>' + p.direction + '</td><td>' + p.departure + ' <span class="text-' + p.delay_color + '">(' + p.delay + ')</span></td></tr>';
    } else {
      transport_el.innerHTML = '<tr><td><img src="' + p.line_pic + '"></td><td>' + p.direction + '</td><td>' + p.departure + '</td></tr>';
    }
  }
};



// #######
// Buttons
// #######

/*
var buttons = [
  [ "home/livingroom/windowright/lamp", "Wohnzimmer - Stehlampe" ],
  [ "home/livingroom/tvcorner/lamp", "Wohnzimmer - Lampe beim Fernseher" ],
  [ "home/lab/behindrouter/uvexposer", "Arbeitszimmer - UV-Belichter" ],
  [ "home/diningroom/onbigshelf/lamp", "Esszimmer - Lampe auf dem Regal" ],
  [ "home/lab/shelfbydesk/desklamp", "Arbeitszimmer - Lampe 1" ],
  [ "home/lab/shelfbydesk/uvsafelamp", "Arbeitszimmer - Lampe 2" ],
  [ "home/lab/shelfbydesk/speakers", "Arbeitszimmer - Lautsprecher" ],
  [ "home/lab/shelfbydesk/empty4", "Arbeitszimmer - leer" ],
  [ "home/lab/shelfbydesk/empty5", "Arbeitszimmer - leer" ],
  [ "home/balcony/ballustraderight/sensor", "Garage auf!" ],
];

*/
var buttons = [
  [ "raw/RF12/socket/1/1", "Wohnzimmer - Stehlampe" ],
  [ "raw/RF12/socket/2/1", "Wohnzimmer - Lampe beim Fernseher" ],
  [ "raw/RF12/socket/3/1", "Arbeitszimmer - UV-Belichter" ],
  [ "raw/RF12/socket/4/1", "Esszimmer - Lampe auf dem Regal" ],
  [ "raw/RF12/socket/5/1", "Arbeitszimmer - Lampe 1" ],
  [ "raw/RF12/socket/5/2", "Arbeitszimmer - Lampe 2" ],
  [ "raw/RF12/socket/5/3", "Arbeitszimmer - Lautsprecher" ],
  [ "raw/RF12/socket/5/4", "Arbeitszimmer - leer" ],
  [ "raw/RF12/socket/5/5", "Arbeitszimmer - leer" ],
  [ "raw/RF12/sensornode/1", "Garage auf!" ],
];



function onButtonClicked(topic, payload) {
  var real_topic = topic.id;
  real_topic = real_topic.replace(/-/g, '/');
  var real_payload = new String;
  real_payload = payload;
  mqtt.send(real_topic + "/set", real_payload);
};

function drawButtons() {
  var main_div = document.getElementById('content');
  
  var buttons_div = document.createElement("DIV");
  buttons_div.classList.add('page');
  buttons_div.id = 'buttons_div';
  
  var buttongroup_div = document.createElement("DIV");
  buttongroup_div.classList.add('btn-group', 'btn-group-vertical');
  buttongroup_div.id = 'buttons';

  buttons_div.appendChild(buttongroup_div);
  main_div.appendChild(buttons_div);

  for (index = 0; index < buttons.length; index++) {
    var button_id = buttons[index][0];
    button_id = button_id.replace(/\//g, '-');
    console.log("button_id: " + button_id);
    $('#buttons').append('<button class="btn btn-lg btn-secondary button Unknown" id="' + button_id + '">' + buttons[index][1] + '</button>');
  }

};

function updateButton(topic, payload) {
  topic = topic.replace(/-[^-]+$/, '');
  var button_el = document.getElementById(topic);
  var click_payload = "0";
  if (payload == 0) {
    click_payload = "1";
  }
  if(button_el) {
    button_el.onclick = function(){ onButtonClicked(this, click_payload);};
    button_el.classList.remove('Unknown', 'On', 'Off');
    if (payload == 1) {
      button_el.classList.add('On');
    } else {
      button_el.classList.add('Off');
    }
  }
};

// ##########
// UV exposer
// ##########

var timers = [
  [ 5, "Test 5s" ],
  [ 10, "Test 10s" ],
  [ 100, "Expose Etchresist" ],
  [ 300, "Expose Soldermask" ],
  [ 900, "Cure Soldermask" ],
];
var safe_lights = [ "raw/RF12/socket/5/2" ];
var unsafe_lights = [ "raw/RF12/socket/5/1" ];
var exposer_address = "raw/RF12/socket/5/5";

function drawExposer() {
  var main_div = document.getElementById('content');

  var uvexposer_div = document.createElement("DIV");
  uvexposer_div.classList.add('page');
  uvexposer_div.id = 'uvexposer_div';

  var buttons_div = document.createElement("DIV");
  buttons_div.classList.add('btn-group', 'btn-group-vertical');
  buttons_div.id = 'timer_buttons';

  uvexposer_div.appendChild(buttons_div);
  main_div.appendChild(uvexposer_div);

  timers.forEach(function(entry, index, a) {
    var seconds = entry[0];
    var name = entry[1];
    var timer_start = document.createElement("BUTTON");
    timer_start.classList.add('btn', 'btn-lg', 'button');
    timer_start.id = 'button-' + seconds;
    timer_start.innerHTML = name;
    timer_start.onclick = function(){ startTimer(seconds); };
    buttons_div.appendChild(timer_start);
  });
};


function startTimer(seconds) {
  var button_el = document.getElementById('button-' + seconds);
  var orig_html = button_el.innerHTML;
  button_el.disabled = true;
  mqtt.send(exposer_address + "/set", "1");
  var ti_id = setInterval(function() {
    if (seconds > 0) {
      button_el.innerHTML = --seconds + ' seconds';
    } else {
      mqtt.send(exposer_address + "/set", "0");
      clearInterval(ti_id);
      button_el.innerHTML = orig_html;
      button_el.disabled = false;
      //drawExposer();
    }
  }, 1000);
};


// #################
// MQTT Sensor Table
// #################

function drawSensorPage() {
  var main_div = document.getElementById('content');

  var sensor_div = document.createElement("DIV");
  sensor_div.classList.add('page');
  sensor_div.id = 'sensor_div';

  var sensor_table = document.createElement("TABLE");
  sensor_table.classList.add('table', 'table-striped');
  sensor_table.id = 'sensor_table';

  var header = document.createElement("THEAD");
  var header_row = document.createElement("TR");
  var body = document.createElement("TBODY");
  body.id = 'sensors-tbody';

  Object.keys(sensor_headers).forEach(function(e, i, a) {
    var header_cell = document.createElement("TH");
    var header_text = document.createTextNode(sensor_headers[e]);

    header_cell.appendChild(header_text);
    header_row.appendChild(header_cell);

  });

  header.appendChild(header_row);
  sensor_table.appendChild(header);
  sensor_table.appendChild(body);
  sensor_div.appendChild(sensor_table);
  main_div.appendChild(sensor_div);


  sensors.forEach(function(entry, index, a) {
        var sensor_row = document.createElement("TR");
        sensor_row.setAttribute("id", sensors.name + '-' + index);
        body.appendChild(sensor_row);
  });
  
}

function updateSensors(topic, payload) {
  var p = JSON.parse(payload);
  var name = topic.replace(/raw-(.*)-data/, '$1');
  var index = p.index;
  sensors[topic] = p;
  sensors[topic]["name"] = name;

  var row_el = document.getElementById(name);
  if (!row_el) {
    var tbody_el = document.getElementById('sensors-tbody');
    row_el = document.createElement("TR");
    row_el.classList.add('data_tr');
    row_el.id = name;
    tbody_el.appendChild(row_el);
    Object.keys(sensor_headers).forEach(function(e, i, a) {
      var td = document.createElement("TD");
      td.id = e;
      row_el.appendChild(td);
    });
  }
  Object.keys(sensor_headers).forEach(function(e, i, a) {
    td = document.getElementById(e);
    td.innerHTML = sensors[topic][e];
  });
  row_el.classList.add('highlight');
  setTimeout(function() {
    row_el.classList.remove('highlight');
  }, 10);

};



