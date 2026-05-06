/**
 * The available form modes that you might want to pass around as metadata to some logic.
 * I needed this for making certain equipment fields read only, but passing a readOnly parameter felt overly specific.
 */
export enum FormMode {
    /** For when you can view a list of a bunch of records. **/
    list = 'list',
    /** For when you can open a single record to view. **/
    view = 'view',
    /** For when you want to edit an existing record. **/
    edit = 'edit',
    /** For when you want to create a new record. **/
    create = 'create',
  }
  