# node-red-contrib-hass
Node-RED node to publish states directly to **Home Assistant** (https://home-assistant.io)

##Usage

Publishes **msg.payload** via POST to Home Assistant using the RESTful API

The API method called is `/api/states/<entity_id>`

**msg.payload** must be a JSON object with at least a state attribute:
```
{
    "state": "custom_state",
    "attributes": {
        "attr1":"value1",
        "attr2":"value2"
    }
}
```

If needed, also a *unit_of_measurement* attribute can be set.

More info on the API [here](https://home-assistant.io/developers/rest_api/).

**EntityId** must be set in the node or in `msg.entityid`

##Configuration

The configuration of the Home Assistant server must be specified in a configuration node, and can be shared between several nodes.

The configuration parameters are:
- server (defaults to http://localhost)
- port (defaults to 8123)
- Long-Lived Access Token