var data = decodeToJson(payload);
var deviceName = data.deviceInfo.deviceName;
var deviceType = data.deviceInfo.deviceProfileName;
var groupName = 'IAQ devices';
// var customerName = 'Customer A';
// use assetName and assetType instead of deviceName and deviceType
// to automatically create assets instead of devices.
// var assetName = 'Asset A';
// var assetType = 'building';

// If you want to parse incoming data somehow, you can add your code to this function.
// input: bytes
// expected output:
//  {
//    "attributes": {"attributeKey": "attributeValue"},
//    "telemetry": {"telemetryKey": "telemetryValue"}
//  }
//
// In the example - bytes will be saved as HEX string and also parsed as light level, battery level and PIR sensor value.
//

function decodePayload(inputArray) {
    var output = {attributes: {}, telemetry: {}};
    // --- Decoding code --- //
    var input = bytesToExecutionArrayList(inputArray);
    output.telemetry.HEX_bytes = bytesToHex(input);

    var decoded = {};
    decoded.hexString = bytesToHex(input);

    for (var i = 0; i < input.length - 3;) {
        var channel_id = input[i++] & 0xff;
        var channel_type = input[i++] & 0xff;

        // BATTERY
        if (channel_id === 0x01 && channel_type === 0x75) {
            decoded.battery = input[i++] & 0xff;
        }
        // TEMPERATURE
        if (channel_id == 0x03 && channel_type == 0x67) {
            decoded.temperature = parseBytesToInt(input, i, 2, false) / 10;
            i += 2;
        }
        // HUMIDITY
        if (channel_id === 0x04 && channel_type === 0x68) {
            decoded.humidity = (input[i++] & 0xff) / 2.0;
        }
        // GPIO
        else if (channel_id === 0x05 && channel_type === 0x00) {
            decoded.gpio = input[i++] & 0xff;
        }
        // GPIO -> PULSE COUNTER
        else if (channel_id === 0x05 && channel_type === 0xc8) {
            decoded.pulse = parseBytesToInt(input, i, 4, false);
            i += 4;
        }
        // Water
        else if (channel_id === 0x05 && channel_type === 0xe1) {
            decoded.water_conv = parseBytesToInt(input, i, 2, false) / 10;
            decoded.pulse_conv = parseBytesToInt(input, i + 2, 2, false) / 10;
            decoded.water = parseBytesIntToFloat(input, i + 4, 4, false);
            i += 8;
        }
        // GPIO ALARM
        else if (channel_id === 0x85 && channel_type === 0x00) {
            decoded.gpio = readGPIOStatus(input[i] & 0xff);
            decoded.gpio_alarm = readGPIOAlarm(input[i + 1] & 0xff);
            i += 2;
        }
        // WATER ALARM
        else if (channel_id === 0x85 && channel_type === 0xe1) {
            decoded.water_conv = parseBytesToInt(input, i, 2, false) / 10;
            decoded.pulse_conv = parseBytesToInt(input, i + 2, 2) / 10;
            decoded.water = parseBytesIntToFloat(input, i + 4, 4);
            decoded.water_alarm = readWaterAlarm(input[i + 8] & 0xff);
            i += 9;
        }

        // HISTORICAL DATA
        else if (channel_id === 0x20 && channel_type === 0xCE) {
            var timestamp = parseBytesToInt(input, i, 4, false);
            var values = {};
            values.temperature = parseBytesToInt(input, i+4, 2, false);
            values.humidity = input[i + 6] & 0xff;
            values.gpio_type = readGPIOType(input[i + 7] & 0xff);
            values.gpio = readGPIOStatus(input[i + 8] & 0xff);
            values.pulse =  parseBytesToInt(input, i+9, 4, false);

            i += 13;
            if (decoded.history === null) {
                decoded.history = [];
            }
            var dataWitTs = {
                "ts": timestamp,
                "values": values
            };
            decoded.history.push(dataWitTs);
        }
        // HISTORICAL DATA2
        else if (channel_id === 0x21 && channel_type === 0xCE) {
            var timestamp2 = parseBytesToInt(input, i, 4, false);

            var values2 = {};
            values2.temperature = parseBytesToInt(input, i+4, i+6, false);
            values2.humidity = input[i + 7] & 0xff;
            values2.alarm = readAlarmHistory(input[i + 8] & 0xff);
            values2.gpio_type = readGPIOType(input[i + 9] & 0xff);
            values2.gpio = readGPIOStatus(input[i + 10] & 0xff);
            values2.water_conv =  parseBytesToInt(input, i+10, i+12, false);
            values2.pulse_conv =  parseBytesToInt(input, i+12, i+14, false);
            values2.water = parseBytesToInt(input, i+14, i+18, false);

            i += 18;
            if (decoded.history === null) {
                decoded.history = [];
            }
            var dataWitTs = {
                "ts": timestamp2,
                "values": values2
            };
            decoded.history.push(dataWitTs);
        }

    }
    if (decoded.?history.size() > 0) {
        output.history = decoded.history;
        decoded.remove("history");
    }
    output.telemetry = decoded;
    return output;
}

function readGPIOStatus(input) {
    // 0: low, 1: high
    switch (input) {
        case 0:
            return "low";
        case 1:
            return "high";
        default:
            return "unknown";
    }
}

function readGPIOType(input) {
    // 1: gpio, 2: pulse
    switch (input) {
        case 1:
            return "gpio";
        case 2:
            return "pulse";
        default:
            return "unknown";
    }
}
function readGPIOAlarm(input) {
    switch (input) {
        case 0:
            return "gpio alarm release";
        case 1:
            return "gpio alarm";
        default:
            return "unknown";
    }
}

function readWaterAlarm(input) {
    // 1: water outage timeout alarm, 2: water outage timeout alarm release, 3: water flow timeout alarm, 4: water flow timeout alarm release
    switch (input) {
        case 1:
            return "water outage timeout alarm";
        case 2:
            return "water outage timeout alarm release";
        case 3:
            return "water flow timeout alarm";
        case 4:
            return "water flow timeout alarm release";
        default:
            return "unknown";
    }
}


function readAlarmHistory(input) {
    // 0: none, 1: water outage timeout alarm, 2: water outage timeout alarm release, 3: water flow timeout alarm, 4: water flow timeout alarm release, 5: gpio alarm, 6: gpio alarm release
    switch (input) {
        case 0:
            return "none";
        case 1:
            return "water outage timeout alarm";
        case 2:
            return "water outage timeout alarm release";
        case 3:
            return "water flow timeout alarm";
        case 4:
            return "water flow timeout alarm release";
        case 5:
            return "gpio alarm";
        case 6:
            return "gpio alarm release";
        default:
            return "unknown";
    }
}

// --- attributes and telemetry objects ---
var telemetry = {};
var attributes = {};
// --- attributes and telemetry objects ---

// --- Timestamp parsing
var dateString = data.time;
var timestamp = -1;
if (dateString != null) {
    timestamp = new Date(dateString).getTime();
    if (timestamp == -1) {
        var secondsSeparatorIndex = dateString.lastIndexOf('.') + 1;
        var millisecondsEndIndex = dateString.lastIndexOf('+');
        if (millisecondsEndIndex == -1) {
            millisecondsEndIndex = dateString.lastIndexOf('Z');
        }
        if (millisecondsEndIndex == -1) {
            millisecondsEndIndex = dateString.lastIndexOf('-');
        }
        if (millisecondsEndIndex == -1) {
            if (dateString.length >= secondsSeparatorIndex + 3) {
                dateString = dateString.substring(0, secondsSeparatorIndex + 3);
            }
        } else {
            dateString = dateString.substring(0, secondsSeparatorIndex + 3) +
                dateString.substring(millisecondsEndIndex, dateString.length);
        }
        timestamp = new Date(dateString).getTime();
    }
}
// If we cannot parse timestamp - we will use the current timestamp
if (timestamp == -1) {
    timestamp = Date.now();
}
// --- Timestamp parsing

// You can add some keys manually to attributes or telemetry
attributes.deduplicationId = data.deduplicationId;

// You can exclude some keys from the result
var excludeFromAttributesList = ["deviceName", "rxInfo", "confirmed", "data", "deduplicationId", "time", "adr", "dr", "fCnt"];
var excludeFromTelemetryList = ["data", "deviceInfo", "txInfo", "devAddr", "adr", "time", "fPort", "region_common_name", "region_config_id", "deduplicationId"];

// Message parsing
// To avoid paths in the decoded objects we passing false value to function as "pathInKey" argument.
// Warning: pathInKey can cause already found fields to be overwritten with the last value found.

var telemetryData = toFlatMap(data, excludeFromTelemetryList, false);
var attributesData = toFlatMap(data, excludeFromAttributesList, false);

var uplinkDataList = [];

// Passing incoming bytes to decodePayload function, to get custom decoding
var customDecoding = decodePayload(base64ToBytes(data.data));

var telemetries;
telemetry.putAll(telemetryData);
// Collecting data to result
var telemetryValues = {};
if (customDecoding.?telemetry.size() > 0) {
    telemetryValues = {
        ts: timestamp,
        values: telemetry
    };
    telemetry.putAll(customDecoding.telemetry);
}


if (customDecoding.?history.size() > 0) {
    telemetries = customDecoding.history;
    if (telemetryValues.size() > 0) {
        telemetries.push(telemetryValues);
    }
} else {
    telemetries = telemetryValues;
}

attributes.putAll(attributesData);


if (customDecoding.?attributes.size() > 0) {
    attributes.putAll(customDecoding.attributes);
}


var result = {
    deviceName: deviceName,
    deviceType: deviceType,
    groupName: groupName,
    attributes: attributes,
    telemetry: telemetries
};

return result;
