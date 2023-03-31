const { is, capitalize, errorFmt } = require("@architect/inventory/src/lib")

const unique = objArray => [...new Set(objArray.map(i => Object.keys(i)[0]))]

module.exports = {
	deploy: {
		start: async ({ arc, cloudformation }) => {
			let cfn = cloudformation

			const localIndexes = arc["tables-local-indexes"]
			if (!Array.isArray(localIndexes) || !localIndexes.length) return cloudformation

			if (!Array.isArray(arc.tables) || !unique(localIndexes).every(i => unique(arc.tables).includes(i))) {
				throw ReferenceError(`Specifying @tables-local-indexes requires specifying corresponding @tables`)
			}

			// Loop thru manifest tables
			arc.tables.forEach(table => {
				const name = Object.keys(table).pop()
				const tableName = name
					?.split(/[-._]/)
					.map(p => capitalize(p))
					.join("")
					.concat("Table")

				const tableProperties = cfn.Resources[tableName].Properties

				// Reduce Local Indexes from manifest into CloudFormation DynamoDB properties
				cfn.Resources[tableName].Properties = localIndexes
					.filter(localIndex => Object.keys(localIndex).pop() === name)
					.reduce((lsiProps, localIndex, i) => {
						const pk = tableProperties.KeySchema.filter(k => k.KeyType === "HASH")[0].AttributeName
						const lsiTemplate = {
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

						// Check if table has no Local Index
						const hasLocalIndex = unique(localIndexes).includes(Object.keys(table)[0])

						// Reduce Local Indexes' attributes into CloudFormation LSI properties
						const attribs = Object.entries(localIndex[name])
						return !hasLocalIndex
							? lsiProps
							: attribs.reduce(
									(cfnProps, attr, seq) => {
										let cfnLSI = seq === 0 ? lsiTemplate : cfnProps.LocalSecondaryIndexes[i]

										switch (attr[0]) {
											case "name":
												cfnLSI.IndexName = attr[1]
												break
											case "projection":
												if (attr[1] === "keys") {
													cfnLSI.Projection.ProjectionType = "KEYS_ONLY"
												} else if (attr[1] === "all") {
													cfnLSI.Projection.ProjectionType = "ALL"
												} else {
													cfnLSI.Projection.ProjectionType = "INCLUDE"
													cfnLSI.Projection.NonKeyAttributes = Array.isArray(attr[1]) ? attr[1] : attr[1].split(" ")
												}
												break
											default:
												if (is.sortKey(attr[1])) {
													cfnLSI.KeySchema.map(key => (key.KeyType === "RANGE" ? (key.AttributeName = attr[0]) : null))
													const sortKeyType = attr[1] ? attr[1].replace("**", "").slice(0, 1).toUpperCase() : "S"
													cfnProps.AttributeDefinitions.push({
														AttributeName: attr[0],
														AttributeType: sortKeyType,
													})
												} else if (is.primaryKey(attr[1]) && attr[1] !== pk) {
													throw ReferenceError(
														`The partition key of a Local Secondary Index must be the same of the base table (${pk}). It cannot be ${attr[0]}.`
													)
												}
										}

										// Build IndexName if one is not provided
										const sk = cfnLSI.KeySchema.filter(k => k.KeyType === "RANGE")[0].AttributeName
										cfnLSI.IndexName ??= `${pk}-${sk}-index`

										// Update Cloudformation properties
										if (seq === 0) {
											cfnProps.LocalSecondaryIndexes ??= []
											cfnProps.LocalSecondaryIndexes.push(cfnLSI)
										} else {
											cfnProps.LocalSecondaryIndexes[i] = cfnLSI
										}

										return cfnProps
									},
									{ ...lsiProps }
							  )
					}, tableProperties)
			})

			return cfn
		},
	},
}
