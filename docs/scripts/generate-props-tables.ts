import fs from 'fs';
import path from 'path';
import { globbyStream } from 'globby';
import json2md from 'json2md';
import { getCatalog, sharedCategories } from './util/getCatalog';
import type {
  Catalog,
  Category,
  ComponentName,
  Properties,
  Property,
} from './types/catalog';

const catalog = getCatalog();

console.log(' 🐻 catalog: ', JSON.stringify(getCatalog(), null, 2));

createAllPropsTables();

async function createAllPropsTables() {
  for await (const componentFilepath of globbyStream(
    path.join(
      __dirname,
      '../../docs/src/pages/[platform]/components/alert/index.page.mdx'
    )
  )) {
    const regex =
      /src\/pages\/\[platform\]\/components\/(\w*)\/index\.page\.mdx/;
    const componentPageName = (componentFilepath as string).match(
      regex
    )[1] as Lowercase<ComponentName>;
    const properties = getObjectValueWithCaselessKey(
      catalog,
      componentPageName
    )?.properties;
    const propsSortedByCategory = getPropsSortedByCategory(
      properties,
      componentPageName
    );

    // console.log('🍰', propsSortedByCategory);

    const expander = createPropsTableExpander(propsSortedByCategory);
    const componentName = Object.keys(
      propsSortedByCategory[0]
    )[0] as ComponentName;

    // console.log('⭐ table:', expander);

    const output = getOutput(
      componentPageName,
      json2md([
        {
          Expander: {
            ExpanderItems: expander,
            defaultOpen: componentName,
          },
        },
      ])
    );

    fs.writeFileSync(
      path.join(
        __dirname,
        '../../docs/src/pages/[platform]/components/',
        `./${componentPageName}/props-table.mdx`
      ),
      output
    );
    console.log(`✅ ${componentPageName} Props Tables are updated.`);
  }
}

type PropsTable = {
  headers: ['Name', 'Type', 'Description'];
  rows: string[];
};
type PropsTables = PropsTable[];
type CategoryProperty = { [key in Category]: Properties };
type SortedPropertiesByCategory = CategoryProperty[];

json2md.converters.Expander = ({ ExpanderItems, defaultOpen }, json2md) => `
<Expander type="multiple" defaultValue={['${defaultOpen}']}>
  ${json2md([...ExpanderItems.map((item) => ({ ...item }))])}
</Expander>
`;
json2md.converters.ExpanderItem = ({ title, value, children }, json2md) => `
<ExpanderItem title="${title}" value="${value}">
    ${json2md(children)}
</ExpanderItem>
`;

json2md.converters.plainText = (text, json2md) => text;

function getOutput(displayName, propsTables) {
  return `
{/* DO NOT EDIT DIRECTLY */}
{/* This file is autogenerated by "docs/scripts/generate-props-tables.ts" script. */}
{/* See Docs README to generate */}
import { Expander, ExpanderItem } from '@aws-amplify/ui-react';

## ${displayName} Props

${propsTables}
`;
}

function createPropsTableExpander(
  propsSortedByCategory: SortedPropertiesByCategory
): { ExpanderItem: { title: string; value: string; children: any[] } }[] {
  return propsSortedByCategory.map((categoryProperty) => {
    const category = Object.keys(categoryProperty)[0];
    const table = createPropsTable(categoryProperty);
    return {
      ExpanderItem: {
        title: category === 'Props' ? 'Amplify UI Props' : category,
        value: category,
        children: [{ table }],
      },
    };
  });
}

function createPropsTable(categoryProperty: CategoryProperty) {
  if (!categoryProperty) return null;
  const properties = Object.values(categoryProperty)[0];
  const rows = Object.entries(properties).map(
    ([propName, { name, type, description }]) => ({
      Name: name.replaceAll(/[{}]/g, '\\$&'),
      Type: type.replaceAll(/[{}]/g, '\\$&'),
      Description: description,
    })
  );
  return {
    headers: ['Name', 'Type', 'Description'],
    rows,
  };
}

type PropertiesByCategory = Record<Category, Properties>;

function getPropsSortedByCategory(
  properties: Properties,
  componentPageName: Lowercase<ComponentName>
): SortedPropertiesByCategory {
  if (properties) {
    let propertiesByCategory: PropertiesByCategory = {} as PropertiesByCategory;

    for (const propertyName in getObjectValueWithCaselessKey(
      catalog,
      componentPageName
    ).properties) {
      const property = getObjectValueWithCaselessKey(catalog, componentPageName)
        .properties[propertyName];
      propertiesByCategory = {
        ...propertiesByCategory,
        [property.category]: {
          ...propertiesByCategory[property.category],
          [propertyName]: property,
        },
      };
    }

    const componentName =
      Object.keys(propertiesByCategory).find(
        (category) => category.toLowerCase() === componentPageName
      ) ?? (componentPageName as ComponentName | Lowercase<ComponentName>);

    const allCategories = [
      componentName,
      ...Object.keys(propertiesByCategory)
        .filter((category) => ![componentName, 'Other'].includes(category))
        .sort((a, b) => a.localeCompare(b)),
      'Other',
    ] as (Category | 'Other')[];

    return allCategories
      .map(
        (category) =>
          ({
            [category]: getObjectValueWithCaselessKey(
              propertiesByCategory,
              category
            ),
          } as {
            [key in Category]: Properties;
          })
      )
      .filter((val) => Object.values(val)[0]);
  } else {
    console.log(` 🫥  ${componentPageName} doesn't have any type properties.`);
  }
}

/**
 *
 * @name getProperties
 * @description case-insensitively get the values from an object
 */
function getObjectValueWithCaselessKey(
  object: PropertiesByCategory,
  key:
    | ComponentName
    | Lowercase<ComponentName>
    | Category
    | Lowercase<Category>
    | 'Other'
): Properties;
function getObjectValueWithCaselessKey(
  object: Catalog,
  key:
    | ComponentName
    | Lowercase<ComponentName>
    | Category
    | Lowercase<Category>
    | 'Other'
): {
  properties: Properties;
};
function getObjectValueWithCaselessKey(object, key) {
  const asLowercase = key.toLowerCase();
  return object[
    Object.keys(object).find((k) => k.toLowerCase() === asLowercase)
  ];
}
