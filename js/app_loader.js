// ################
// Global variables
// ################

var mqtt;
var reconnectTimeout = 2000;
var topics = [];

var pages = {};
var active_page = {};
var edit_mode = 0;

var device_map = {};
var devs_by_room = [];

//var seen_devices = {};

var roomheader_tags =  {
  temp: [ "Temp:", "°C" ],
  humi: [ "Humi:", "%" ],
  light: [ "Light", "lx" ],
  vbat: [ "Bat:", "V" ],
};

var sensor_headers =  {
  name: "Name",
  val: "Value",
  light: "Light",
  temp: "Temperature",
  humi: "Humidity",
  vsol: "V Solar",
  vbat: "V Bat.",
  moved: "Movement",
  lowbat: "Bat. Low",
};

var global_config = {
  stations: [],
  sensors: [],
  buttons: [
    { pub: "RF12/set/socket/1/1", sub: "RF12/status/socket/1/1", name: "Wohnzimmer - Stehlampe" },
    { pub: "RF12/set/socket/2/1", sub: "RF12/status/socket/2/1", name: "Wohnzimmer - Lampe beim Fernseher" },
    { pub: "RF12/set/socket/4/1", sub: "RF12/status/socket/4/1", name: "Esszimmer - Lampe auf dem Regal" },
    { pub: "RF12/set/socket/3/1", sub: "RF12/status/socket/3/1", name: "Arbeitszimmer - UV-Belichter" },
    { pub: "RF12/set/socket/5/1", sub: "RF12/status/socket/5/1", name: "Arbeitszimmer - Lampe 1" },
    { pub: "RF12/set/socket/5/2", sub: "RF12/status/socket/5/2", name: "Arbeitszimmer - Lampe 2" },
    { pub: "RF12/set/socket/5/3", sub: "RF12/status/socket/5/3", name: "Arbeitszimmer - Lautsprecher" },
    { pub: "RF12/set/socket/5/4", sub: "RF12/status/socket/5/4", name: "Arbeitszimmer - leer" },
    { pub: "RF12/set/socket/5/5", sub: "RF12/status/socket/5/5", name: "Arbeitszimmer - Display" },
    { pub: "RF12/set/sensornode/1", sub: "RF12/status/sensornode/1", name: "Garage auf!" },
  ],
};


function loadGlobals() {
  if (localStorage.getItem('global_config')) {
    global_config = JSON.parse(localStorage.getItem('global_config'));
    global_config.sensor_headers = sensor_headers;
    global_config.roomheader_tags = roomheader_tags;
  }

  global_config.button_timers = {};
}

function saveGlobals() {
  localStorage.setItem('global_config', JSON.stringify(global_config));
}

function getDeviceMap() {
  mqtt.subscribe('NODE-RED/device_map', {qos: 2});
  active_page['onMessageArrived'] = function(message) {
    global_config.device_map = JSON.parse(message.payloadString);
    mqtt.unsubscribe('NODE-RED/device_map', {});

    // populate a few local (to the browser) objects
    device_map = global_config.device_map.devices;

    Object.keys(global_config.device_map.rooms).forEach(function(e){
      devs_by_room[e] = [];
    });

    Object.keys(device_map).forEach(function(e){
      // get the device object
      var dev = device_map[e];

      dev.room = dev.location_topic.replace(/\+\/home\/([^\/]+)\/.*/, '$1');
      dev.pub_topic = e.replace(/\+/, 'set');
      dev.sub_topic = e.replace(/\+/, 'status');

      devs_by_room[dev.room].push(e);

      //write the object back
      device_map[e] = dev;
    });

    render(decodeURI(window.location.hash));
  };
};


$(document).ready(function() {
  loadGlobals();
  drawNav();
  MQTTconnect();
});

$(window).on('hashchange', function(){
  render(decodeURI(window.location.hash));
});



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
    mqtt.onMessageArrived = function(message) { active_page['onMessageArrived'](message) };
    //mqtt.onMessageArrived = onMessageArrived;

    if (username != null) {
        options.userName = username;
        options.password = password;
    }
    console.log("Host="+ host + ", port=" + port + ", path=" + path + " TLS = " + useTLS + " username=" + username + " password=" + password);
    mqtt.connect(options);
}

function onConnect() {
    getDeviceMap();
    updateStatus(true, 'Connected to ' + host);
}

function onConnectionLost(response) {
    setTimeout(MQTTconnect, reconnectTimeout);
    updateStatus(false, 'Not connected');
    //$('#status').val("connection lost: " + responseObject.errorMessage + ". Reconnecting");

};


/*
function onMessageArrived(message) {

  var topic = message.destinationName;
  var payload = message.payloadString;

  console.log("MQTT Message: " + topic + " " + payload);
  topic = topic.replace(/\//g, '-');

  active_page['onMessageArrived'](topic, payload);

};
*/


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


// Navigation

function drawNav() {
  var nav_elements = [
    [ "#public_transport", "Public Transport" ],
    [ "#sensors", "Sensors" ],
    [ "#buttons", "Buttons" ],
    [ "http://wsan1/sm/index.html", "Smartmeter" ],
    [ "http://wsan1:1880", "Node-Red" ],
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

  $('#nav_header').prepend(' <button type="button" class="navbar-toggle" data-toggle="collapse" data-target="#nav_collapse"> <span class="icon-bar"></span> <span class="icon-bar"></span> <span class="icon-bar"></span>                        </button> <a class="navbar-brand" href="#"> <span id="server_status" class="logo-red" aria-hidden="true">Home</span></a>');

  for (index = 0; index < nav_elements.length; index++) {
    var nav_element_id = nav_elements[index][0];
    nav_element_id = nav_element_id.replace(/\//g, '-');
    if (nav_elements[index][0].match(/^#/)) {
      $('#nav_list').append('<li class="nav-item"><a class="nav-link" id="' + nav_element_id + '" href="' + nav_elements[index][0]+ '">' + nav_elements[index][1] + '</a></li>');
    } else {
      $('#nav_list').append('<li class="nav-item"><a class="nav-link" id="' + nav_element_id + '" target="_blank" href="' + nav_elements[index][0]+ '">' + nav_elements[index][1] + '</a></li>');
    }
  }

  var edit_div = document.createElement("DIV");
  edit_div.id = 'edit_button_div';
  edit_div.innerHTML = '<ul class="nav navbar-nav navbar-right"><li class="nav-item"><p class="btn edit_item" id="cancel_button" role="button" onclick="cancelEditMode()">Cancel</p></li><li class="nav-item"><p class="btn" id="edit_button" role="button" onclick="toggleEditMode()">Edit</p></li></ul>';
  nav_collapse.appendChild(edit_div);

  // collapse the navbar if a link is clicked
  $('.navbar-collapse').click('li', function() {
    $('.navbar-collapse').collapse('hide');
  });

  $('.navbar-brand').click('span', function() {
    $('.navbar-collapse').collapse('hide');
  });

};

function toggleEditMode() {
  var mode = 1;
  if (document.getElementsByClassName('edit_item visible').length > 0) {
    mode = 0;
  }
  setEditMode(mode);
}

function setEditMode(mode) {
  var edit_button = document.getElementById('edit_button');
  if (mode == true) {
    $('.edit_item').addClass('visible');
    edit_mode = true;
    edit_button.innerHTML = 'Save';
  } else {
    $('.edit_item').removeClass('visible');
    edit_mode = false;
    edit_button.innerHTML = 'Edit';
    saveGlobals();
  }
};

function cancelEditMode() {
  var edit_button = document.getElementById('edit_button');
  $('.edit_item').removeClass('visible');
  edit_mode = false;
  edit_button.innerHTML = 'Edit';
  loadGlobals();
  render(decodeURI(window.location.hash));
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
      active_page['onMessageArrived'] = function(message) {
        updateHouse(message);
      };
      renderHouse();
    },
    '#public_transport': function() {
      active_page['onMessageArrived'] = function(message) {
        updatePublicTransport(message);
      };
      renderPublicTransport();
    },
    '#buttons': function() {
      active_page['onMessageArrived'] = function(message) {
        updateButton(message);
      };
      renderButtons();
    },
    '#uv_exposer': function() {
      active_page['onMessageArrived'] = function(message) {
        updateUVExposer(message);
      };
      renderUVExposer();
    },
    '#sensors': function() {
      active_page['onMessageArrived'] = function(message) {
        updateSensors(message);
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


function updateUVExposer(message){
};

function updateHomepage(message) {
};

function renderHomepage() {
  $('#home_div').addClass('visible');
};

function renderPublicTransport() {
  mqtt.subscribe('WEB/public_transport/#', {qos: 0});
  topics.push('WEB/public_transport/#');
  //loadGlobals();
  if (!pages['stations']) {
    drawStations();
    pages['stations'] = 1;
  }
  $('#pubtrans_div').addClass('visible');
  updateAllStations();
};

function renderButtons() {
  global_config.buttons.forEach(function(e){
    mqtt.subscribe(e.sub, {qos: 0});
    topics.push(e.sub);
  });
  if (!pages['buttons']) {
    drawButtons();
    pages['buttons'] = 1;
  }
  $('#buttons_div').addClass('visible');
};

function renderUVExposer() {
  mqtt.subscribe('+/status/socket/#', {qos: 0});
  topics.push('+/status/socket/#');
  if (!pages['exposer']) {
    drawExposer();
    pages['exposer'] = 1;
  }
  $('#uvexposer_div').addClass('visible');
};

function renderHouse() {
  Object.keys(global_config.device_map.devices).forEach(function(e){
    mqtt.subscribe(e, {qos: 0});
    topics.push(e);
  });
  if (!pages['house']) {
    drawHousePage();
    pages['house'] = 1;
  }
  $('#house_div').addClass('visible');
};

function renderSensors() {
  mqtt.subscribe('+/status/sensornode/#', {qos: 0});
  topics.push('+/status/sensornode/#');
  if (!pages['sensors']) {
    drawSensorPage();
    pages['sensors'] = 1;
  }
  $('#sensor_div').addClass('visible');
};

function renderErrorPage() {
  if (!pages['error']) {
    $('#error_div').html('<h1>Well, fuck.</h1><p>Try the <a href="#">Homepage</a></p>');
    pages['error'] = 1;
  }
  $('#error_div').addClass('visible');
};


// ##########################
// public transport functions
// ##########################

function updateStation(message) {
  var topic = message.destinationName;
  var payload = message.payloadString;
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

  global_config.stations.forEach(function(station){

    var click_payload = JSON.stringify(station);

    var header = document.createElement("THEAD");
    header.classList.add('thead-inverse');
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
    var msg = {};
    msg.payloadString = click_payload;
    msg.destinationName = 'WEB-public_transport-get';
    update_button.onclick = function(){ updateStation(msg);};

    var delete_button = document.createElement("BUTTON");
    delete_button.id = 'public_transpoort_delete-' + station.name;
    delete_button.innerHTML = 'Delete';
    delete_button.classList.add('edit_item', 'button', 'Delete');
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


  var form = document.createElement('FORM');
  form.classList.add('edit_item');
  form.innerHTML = ' <input type="text" id="sta_name" placeholder="Station Name"></input> <input type="text" id="display_lines" placeholder="Number of results"></input> <input type="text" id="time_offset" placeholder="Time offset"></input> <button onclick="addStation()">Add</button>';
  dep_div.appendChild(form);

  dep_div.appendChild(dep_table);
  main_div.appendChild(dep_div);

  setEditMode(edit_mode);
  //saveGlobals();

};

function addStation() {
  var sta = document.getElementById('sta_name');
  var dl = document.getElementById('display_lines');
  var to = document.getElementById('time_offset');
  
  global_config.stations.push({name: sta.value || 'Königstraße', display_lines: dl.value || 4, time_offset: to.value || 6});
  drawStations();
  $('#pubtrans_div').addClass('visible');
  updateAllStations();
};

function deleteStation(station) {
  var filtered = global_config.stations.filter(function(el) {
    return (el != station);
  });
  global_config.stations = filtered;
  drawStations();
  $('#pubtrans_div').addClass('visible');
  updateAllStations();

};

function updateAllStations() {
    global_config.stations.forEach(function(station){
      var click_payload = JSON.stringify(station);
      var msg = {};
      msg.payloadString = click_payload;
      msg.destinationName = 'WEB-public_transport-get';
      updateStation(msg);
    });
};


function updatePublicTransport(message) {
  var topic = message.destinationName;
  var payload = message.payloadString;
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

function drawButtons() {
  var main_div = document.getElementById('content');
  
  var buttons_div = document.getElementById("buttons_div");
  if (buttons_div) {
    buttons_div.innerHTML = '';
  } else {
    buttons_div = document.createElement("DIV");
    buttons_div.classList.add('page');
    buttons_div.id = 'buttons_div';
  }

  var buttongroup_div = document.createElement("DIV");
  buttongroup_div.classList.add('btn-group', 'btn-group-vertical');
  buttongroup_div.id = 'buttons';

  var form = document.createElement('FORM');
  form.classList.add('edit_item');
  form.innerHTML = '<input type="text" id="pub" placeholder="Pub Topic"></input> <input type="text" id="sub" placeholder="Subscribe Topic"></input> <input type="text" id="name" placeholder="Name"> <input type="text" id="payload" placeholder="Payload (int)"></input> <button class="button" onclick="addButton()">Add</button>';
  buttons_div.appendChild(form);

  buttons_div.appendChild(buttongroup_div);
  main_div.appendChild(buttons_div);

  global_config.buttons.forEach(function(e, i) {
    var button_id = e.sub.replace(/\//g, '-') + e.pub.replace(/\//g, '-');
    var button_id = 'button-' + i;
    e.id = button_id;
    console.log("button_id: " + button_id);
    $('#buttons').append('<button type="button" class="btn btn-lg btn-secondary button Unknown" id="' + button_id + '">' + e.name + '</button><button class="btn-sm button edit_item" id="' + button_id + '-delete">delete</button>');

    var button_el = document.getElementById(button_id);
    button_el.onclick = function(){ mqtt.send(e.pub, e.payload);};

    var delete_button = document.getElementById(button_id + '-delete');
    delete_button.onclick = function(){ deleteButton(e); };
  });


};

function updateButton(message) {
  var topic = message.destinationName;
  var payload = message.payloadString;
  
  var click_payload = "0";
  if (payload == 0) {
    click_payload = "1";
  }

  global_config.buttons.forEach(function(e, i) {
    if (topic == e.sub) {
      var button_el = document.getElementById(e.id);
      if (button_el) {
        if (!e.payload) {
          button_el.onclick = function(){ mqtt.send(e.pub, click_payload);};
        }
        button_el.classList.remove('Unknown', 'On', 'Off');
        if (payload === "1") {
          button_el.classList.add('On');
        } else if (payload === "0") {
          button_el.classList.add('Off');
        } else {
          try { var p = JSON.parse(payload); } catch(err) { }
          if (p) {
            if ((!p.display) || (p.display == '##reset##')) {
              p.display = e.name;
            }
            button_el.innerHTML = p.display;
            if (p.val == 1) {
              button_el.classList.add('On');
            } else if (p.val == 0) {
              button_el.classList.add('Off');
            }
          }
        }
      }
    }

/*
    if (e.payload) {
      var button_el = document.getElementById(e.id);
      if (button_el) {
        button_el.onclick = function(){ mqtt.send(e.pub, e.payload);};
        button_el.classList.remove('Unknown', 'On', 'Off');
        button_el.classList.add('Off');
      }
    }
*/
  });
};

function addButton() {
  var pub = document.getElementById('pub');
  var sub = document.getElementById('sub');
  var name = document.getElementById('name');
  var payload = document.getElementById('payload');
  
  global_config.buttons.push({pub: pub.value, sub: sub.value, name: name.value, payload: payload.value});
  drawButtons();
  $('#buttons_div').addClass('visible');
  setEditMode(edit_mode);
  updateAllButtons();
};


function deleteButton(button) {
  var filtered = global_config.buttons.filter(function(el) {
    return (el != button);
  });
  global_config.buttons = filtered;
  drawButtons();
  $('#buttons_div').addClass('visible');
  setEditMode(edit_mode);
  updateAllButtons();
};

function updateAllButtons() {
  global_config.buttons.forEach(function(e){
    mqtt.unsubscribe(e.sub, {});
    mqtt.subscribe(e.sub, {qos: 0});
    //topics.push(e.sub);
  });
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
var safe_lights = [ "RF12/set/socket/5/2" ];
var unsafe_lights = [ "RF12/set/socket/5/1" ];
var exposer_address = "RF12/set/socket/5/4";

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
  mqtt.send(exposer_address, "1");
  var ti_id = setInterval(function() {
    if (seconds > 0) {
      button_el.innerHTML = --seconds + ' seconds';
    } else {
      mqtt.send(exposer_address, "0");
      clearInterval(ti_id);
      button_el.innerHTML = orig_html;
      button_el.disabled = false;
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
  header.classList.add('thead-inverse');
  var header_row = document.createElement("TR");
  var body = document.createElement("TBODY");
  body.id = 'sensors-tbody';

  Object.keys(global_config.sensor_headers).forEach(function(e, i, a) {
    var header_cell = document.createElement("TH");
    var header_text = document.createTextNode(global_config.sensor_headers[e]);

    header_cell.appendChild(header_text);
    header_row.appendChild(header_cell);

  });

  header.appendChild(header_row);
  sensor_table.appendChild(header);
  sensor_table.appendChild(body);
  sensor_div.appendChild(sensor_table);
  main_div.appendChild(sensor_div);


  global_config.sensors.forEach(function(entry, index, a) {
        var sensor_row = document.createElement("TR");
        sensor_row.setAttribute("id", global_config.sensors.name + '-' + index);
        body.appendChild(sensor_row);
  });
  
}

function updateSensors(message) {
  var topic = message.destinationName;
  var payload = message.payloadString;
  var p = JSON.parse(payload);
  var name = topic.replace(/^([^\/]+)\/[^\/]+\/(.*)/, '$1/+/$2');
  global_config.sensors[topic] = p;
  global_config.sensors[topic]["name"] = global_config.device_map.devices[name]['display_name'];

  var row_el = document.getElementById(name);
  if (!row_el) {
    var tbody_el = document.getElementById('sensors-tbody');
    row_el = document.createElement("TR");
    row_el.classList.add('dev_tr');
    row_el.id = name;
    tbody_el.appendChild(row_el);
    Object.keys(global_config.sensor_headers).forEach(function(e, i, a) {
      var td = document.createElement("TD");
      td.id = e;
      row_el.appendChild(td);
    });
  }
  Object.keys(global_config.sensor_headers).forEach(function(e, i, a) {
    td = document.getElementById(e);
    td.innerHTML = global_config.sensors[topic][e];
  });
  row_el.classList.add('highlight');
  setTimeout(function() {
    row_el.classList.remove('highlight');
  }, 10);

};



// #####
// House
// #####

function drawHousePage() {
  var rooms = global_config.device_map.rooms;
  var devices = global_config.device_map.devices;

  var main_div = document.getElementById('content');

  var house_div = document.createElement("DIV");
  house_div.classList.add('page');
  house_div.id = 'house_div';

  var housepage = document.createElement("DIV");
  housepage.classList.add('housepage');
  housepage.id = 'housepage';

  Object.keys(rooms).forEach(function(roomkey, i, a){
    
    // create a box for every room
    var roombox = document.createElement("DIV");
    roombox.id = roomkey + '_roombox';
    roombox.classList.add('roombox');
    housepage.appendChild(roombox);

    // a header box
    var roomheader = document.createElement("DIV");
    roomheader.id = roomkey + '_roomheader';
    roomheader.classList.add('roomheader');
    roombox.appendChild(roomheader);

    // a name tag
    var roomname = document.createElement("DIV");
    roomname.id = roomkey + '_roomname';
    roomname.classList.add('roomname');
    roomname.innerHTML = rooms[roomkey];
    roomheader.appendChild(roomname);


    // build the info table
    var roominfo = document.createElement("DIV");
    roominfo.id = roomkey + '_roominfo';
    roominfo.classList.add('roominfo');
    roomheader.appendChild(roominfo);

    Object.keys(global_config.roomheader_tags).forEach(function(e, i, a) {
      var roominfoitem = document.createElement("DIV");
      roominfoitem.classList.add('roominfoitem');
      roominfoitem.id = roomkey + '_' + e;
      roominfo.appendChild(roominfoitem);
    });

    // populate the button stack
    var grouped_buttons = [];
    devs_by_room[roomkey].forEach(function(devkey){
      if (device_map[devkey].type == 'onoff_group') {
        var roomsubheader = document.createElement("DIV");
        roomsubheader.id = roomkey + '_roomsubheader';
        roomsubheader.innerHTML = device_map[devkey].display_name;
        roomsubheader.classList.add('roomsubheader');
        roombox.appendChild(roomsubheader);

        device_map[devkey].members.forEach(function(memberkey){
          createButton(roombox, memberkey, 'Unknown');
          grouped_buttons.push(memberkey);
        });
      } else if (device_map[devkey].type == 'onoff') {
        if (!grouped_buttons.includes(devkey)) {
          createButton(roombox, devkey, 'Unknown');
        }
      } else if (device_map[devkey].type == 'button' || device_map[devkey].type == 'actionsensor') {
        if (!grouped_buttons.includes(devkey)) {
          createButton(roombox, devkey, 'Off');
        }
      }
    });

  });
  house_div.appendChild(housepage);
  main_div.appendChild(house_div);
}

function createButton(roombox, dev_id, initstate) {
    var dev = device_map[dev_id] || console.log('not found: ' + dev_id);
    var button = document.createElement('DIV');
    button.id = dev_id.replace(/\//g, '-') + '_button';
    button.classList.add('button', 'roombutton');
    button.classList.add(initstate);
    button.innerHTML = dev.display_name;

    var pl = dev.payload || "1";
    button.onclick = function(){ mqtt.send(dev.pub_topic, pl);};

    roombox.appendChild(button);
}


function updateHouse(message) {

  //var payload_is_json = true;
  var topic = message.destinationName;
  var payload = message.payloadString;
  //var dev_key = topic.replace(/\/status\//, '/+/');
  var dev_key = topic.replace(/^([^\/]+)\/[^\/]+\/(.*)/, '$1/+/$2');
  //var pub_topic = topic.replace(/^([^\/]+)\/[^\/]+\/(.*)/, '$1/toggle/$2');
  var dev_id = dev_key.replace(/\//g, '-');
  var dev = device_map[dev_key];
  //var room = dev.location_topic.replace(/\+\/home\/([^\/]+)\/.*/, '$1');

  try { var p_obj = JSON.parse(payload); } catch(err) { }
  try { var button = document.getElementById(dev_id + '_button'); } catch(err) { }

  
  // read sensor data and put it in the roominfo table
  if (dev.type == 'actionsensor' || dev.type == 'sensor') {
    if (typeof(p_obj.val) !== 'undefined') {
      Object.keys(global_config.roomheader_tags).forEach(function(e, i, a) {
        roominfoitem = document.getElementById(dev.room + '_' + e);
        roominfoitem.innerHTML = '<div class="cell_left">' + global_config.roomheader_tags[e][0] + '</div><div class="cell_right">' + p_obj[e] + global_config.roomheader_tags[e][1] + '</div>';
      });

    }

  // update buttons
  } 

  if (dev.type == 'onoff' || dev.type == 'button' || dev.type == 'actionsensor') {
    button.classList.remove('Unknown', 'On', 'Off', 'decay');
    if (dev.decay) { clearTimeout(global_config.button_timers[dev_id]); }

    // onoff devices get their payload updated dynamically
    if (dev.type == 'onoff') {

      if (payload === "1" || p_obj.val == "1") {
        button.classList.add('On');
        button.onclick = function(){ mqtt.send(dev.pub_topic, "0");};
      } else if (payload === "0" || p_obj.val == "0") {
        button.onclick = function(){ mqtt.send(dev.pub_topic, "1");};
        button.classList.add('Off');
      }

    // button devices have static payload but update the display_name
    } else if (dev.type == 'button' || dev.type == 'actionsensor') {
      if (typeof(p_obj.val) !== 'undefined') {
        if (typeof(p_obj.display_name) == 'undefined' || (p_obj.display_name == '##reset##')) {
          p_obj.display_name = dev.display_name;
        }
        button.innerHTML = p_obj.display_name;

        if (p_obj.val == 1) {
          button.classList.add('On');
        } else if (p_obj.val == 0) {
          button.classList.add('Off');
        }
      }
    }
  }

  if (button && dev.decay) {
    global_config.button_timers[dev_id] = setTimeout(function(){
      button.classList.add('decay');
      button.classList.add('Unknown');
    }, 10000);
  }

}
