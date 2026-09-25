export interface MdmAlertPayload {
    Type?: string;
    Repository_Name?: string;
    Model_Name?: string;
    Quarantine_Count?: string | number;
}

export function buildMdmAlertCard(data: MdmAlertPayload, sentBy?: string): object {
    const count = parseInt(String(data.Quarantine_Count ?? "0"), 10);
    const timestamp = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
    });
    const severity =
        count > 50 ? { label: "Critical", color: "attention" } :
            count > 20 ? { label: "High", color: "warning" } :
                count > 5 ? { label: "Medium", color: "accent" } :
                    { label: "Normal", color: "good" };

    return {
        type: "message",
        attachments: [
            {
                contentType: "application/vnd.microsoft.card.adaptive",
                content: {
                    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                    type: "AdaptiveCard",
                    version: "1.5",
                    body: [
                        {
                            type: "Container",
                            style: "emphasis",
                            bleed: true,
                            items: [
                                {
                                    type: "ColumnSet",
                                    columns: [
                                        {
                                            type: "Column",
                                            width: "stretch",
                                            items: [
                                                {
                                                    type: "TextBlock",
                                                    text: "⚠️  MDM Quarantine Alert",
                                                    weight: "Bolder",
                                                    size: "Large",
                                                },
                                                {
                                                    type: "TextBlock",
                                                    text: `${timestamp} IST${sentBy ? `  ·  triggered by ${sentBy}` : ""}`,
                                                    size: "Small",
                                                    isSubtle: true,
                                                    spacing: "None",
                                                },
                                            ],
                                        },
                                        {
                                            type: "Column",
                                            width: "auto",
                                            verticalContentAlignment: "Center",
                                            items: [
                                                {
                                                    type: "TextBlock",
                                                    text: severity.label,
                                                    weight: "Bolder",
                                                    color: severity.color as any,
                                                    size: "Medium",
                                                    horizontalAlignment: "Right",
                                                },
                                                {
                                                    type: "TextBlock",
                                                    text: "SEVERITY",
                                                    size: "Small",
                                                    isSubtle: true,
                                                    horizontalAlignment: "Right",
                                                    spacing: "None",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            type: "Container",
                            spacing: "Medium",
                            items: [
                                {
                                    type: "TextBlock",
                                    text: "Quarantine Details",
                                    weight: "Bolder",
                                    size: "Medium",
                                },
                                {
                                    type: "FactSet",
                                    facts: [
                                        { title: "Type", value: data.Type ?? "MDM" },
                                        { title: "Repository", value: data.Repository_Name ?? "—" },
                                        { title: "Model", value: data.Model_Name ?? "—" },
                                        { title: "Quarantine Count", value: String(data.Quarantine_Count ?? 0) },
                                    ],
                                },
                            ],
                        },
                        {
                            type: "Container",
                            spacing: "Small",
                            style: "emphasis",
                            items: [
                                {
                                    type: "TextBlock",
                                    text: `🗂  Quarantined records: ${data.Quarantine_Count}`,
                                    weight: "Bolder",
                                    color: severity.color as any,
                                },
                            ],
                        },
                    ],
                    actions: [
                        {
                            type: "Action.Submit",
                            title: "🎫 Create Ticket",
                            data: {
                                actionType: "createTicket",
                                alertType: "MDM",
                                Type: data.Type ?? "MDM",
                                Repository_Name: data.Repository_Name,
                                Model_Name: data.Model_Name,
                                Quarantine_Count: data.Quarantine_Count,
                                severity: severity.label,
                            },
                        },
                    ],
                },
            },
        ],
    };
}