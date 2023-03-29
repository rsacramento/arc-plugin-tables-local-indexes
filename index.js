const { is, capitalize } = require("@architect/inventory/src/lib")

const unique = objArray => [...new Set(objArray.map(i => Object.keys(i)[0]))]
// TODO: Update AttributeDefinitions
module.exports = {
	deploy: {
		start: async ({ arc, cloudformation, dryRun, inventory, stage }) => {
			let cfn = cloudformation

			const localIndexes = arc["tables-local-indexes"]
			if (!Array.isArray(localIndexes) || !localIndexes.length) return cloudformation

			const arcTables = arc.tables

			if (!Array.isArray(arcTables) || !unique(localIndexes).every(i => unique(arcTables).includes(i))) {
				throw ReferenceError(`Specifying @tables-local-indexes requires specifying corresponding @tables`)
			}

			arcTables.forEach(table => {
				const name = Object.keys(table).pop()

				const tableName = name
					?.split(/[-._]/)
					.map(p => capitalize(p))
					.join("")
					.concat("Table")

				const lsiProperty = localIndexes
					.filter(arcLSI => Object.keys(arcLSI).pop() === name)
					.reduce((prop, arcLSI) => {
						const pk = cfn.Resources[tableName].Properties.KeySchema.filter(k => k.KeyType === "HASH")[0].AttributeName
						let lsiTemplate = {
							IndexName: undefined,
							KeySchema: [
								{
									AttributeName: pk,
									KeyType: "HASH",
								},
								{
									AttributeName: undefined,
									KeyType: "RANGE",
								},
							],
							Projection: {
								ProjectionType: "ALL",
							},
						}

						const lsiEntries = Object.entries(arcLSI[name])
						const lsi = lsiEntries.reduce((cfnLSI, entry) => {
							switch (entry[0]) {
								case "name":
									cfnLSI.IndexName = entry[1]
									break
								case "projection":
									if (entry[1] === "keys") {
										cfnLSI.Projection.ProjectionType = "KEYS_ONLY"
									} else if (entry[1] === "all") {
										cfnLSI.Projection.ProjectionType = "ALL"
									} else {
										cfnLSI.Projection.ProjectionType = "INCLUDE"
										cfnLSI.Projection.NonKeyAttributes = Array.isArray(entry[1]) ? entry[1] : entry[1].split(" ")
									}
									break
								default:
									if (is.primaryKey(entry[1]) && entry[1] !== pk) {
										throw ReferenceError(
											`The partition key of a Local Secondary Index must be the same of the base table (${pk}). It cannot be ${entry[0]}.`
										)
									}
									if (is.sortKey(entry[1])) {
										cfnLSI.KeySchema.map(key => (key.KeyType === "RANGE" ? (key.AttributeName = entry[0]) : null))
									}
							}

							return cfnLSI
						}, lsiTemplate)

						lsi.IndexName ??= `${pk}-${lsi.KeySchema.filter(k => k.KeyType === "RANGE")[0].AttributeName}-index`

						prop.push(lsi)
						return prop
					}, [])

				cfn.Resources[tableName].Properties.LocalSecondaryIndexes = lsiProperty
			})

			return cloudformation
		},
	},
}
