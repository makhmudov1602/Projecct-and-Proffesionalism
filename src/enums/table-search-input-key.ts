/**
 * The available form modes that you might want to pass around as metadata to some logic.
 * I needed this for making certain equipment fields read only, but passing a readOnly parameter felt overly specific.
 */
export enum tableSearchInputKey {
  /** For when you can view a list of a bunch of records. **/
  input = "input",
  /** For when you can open a single record to view. **/
  select = "select",
  /** For when you want to edit an existing record. **/
  date = "date",
  /** For when you want to create a new record. **/
}
