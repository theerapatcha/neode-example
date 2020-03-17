module.exports = {
    "name": "string",
    "lastModified": "string",
    "id": "string",
    "status": "string",
    "infectTime": "localdatetime",
    "version": "number",
    "profileImageUrl": {
        type: "string",
        uri: {
            scheme: ["http", "https"]
        }
    },

    contacted: {
        type: "relationship",
        target: "Person",
        relationship: "CONTACTED",
        direction: "DIRECTION_BOTH",
        properties: {
            contactTime: "localdatetime"
        }
    }
};