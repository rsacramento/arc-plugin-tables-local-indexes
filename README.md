# @tables-local-indexes

Defines [Local Secondary Indexes][lsi] for your project's [DynamoDB][ddb] tables. `@tables-local-indexes` should only ever be paired with [`@tables`][tables].

## Recommended Resources

[DynamoDB][ddb] is a powerful database, though different from both SQL and NoSQL databases. It is highly recommended to dig into Amazon's resources to familiarize yourself with it:

- [DynamoDB Core Components (start here!)][core]
- [Local Secondary Indexes in DynamoDB][lsi]
- [Amazon's full DynamoDB documentation][ddb]

## Syntax

- Note that local secondary indexes can only be declared at table creation: it cannot be changed afterwards; a new table would need to be created
- `@tables-local-indexes` is a feature subset of [`@tables`][tables]; as such, the names of your declared indexes must match those of your [`@tables`][tables]
- Otherwise, the basic syntax for defining `@tables-local-indexes` primary keys is similar to [`@tables`][tables]:
  - Partition key - beware that local secondary indexes share the same partition key as the base table, so it can be skipped
  - Sort key, defined by `**`, is required
  - Currently only `**String`, and `**Number` are supported
- An optional `name` property can be provided to explicitly name the index. This is helpful when [querying the index with the AWS SDK as you know what to pass to the `IndexName` query parameter](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#query-property)
- An optional `projection` property can be provided to explicitly define which [item attributes get projected][projection], or included, in query results. By default, this plugin will project _all_ item attributes (the `ALL` projection type as described in the [DynamoDB documentation on attribute projections][projection])
  - Customizing which attributes to project can be helpful when trying to save on [bandwidth costs][pricing]
  - Note that once a projection is defined, it cannot be changed; a new table would need to be created
  - Acceptable values for `projection` are:
    - `all` (default): all item attributes from the table are projected into the index
    - `keys`: only the base table partition key and the local secondary index sort key are projected into the index
    - Custom: otherwise, you may define one or more attribute names to explicitly project into the index. Note that the base table partition key and index sort key always get projected

## Example

The following `app.arc` file defines a [DynamoDB][ddb] table with two named [Local Secondary Indexes][gsi], both with `projection` explicitly defined:

```arc
@app
testapp

@tables
accounts
  accountID *String

@tables-local-indexes
accounts
  email **String # Sort key is required!
  projection keys # only project base table partition key and index sort key (in this example that would be accountID and email)
  name byEmail

accounts
  accountID *String # Partition key is the same as the main table, but it is optional
  created **String # Sort key is required!
  projection updated lastAccessed # only project base table partition key and index sort key plus the updated and lastAccessed attributes
```

[tables]: tables
[core]: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html
[ddb]: https://aws.amazon.com/documentation/dynamodb/
[lsi]: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html
[projection]: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html#LSI.Projections
[pricing]: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html#LSI.StorageConsiderations
