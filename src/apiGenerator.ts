import _ = require( 'lodash' );

import { IModelConfiguration, IConfigurationRaw } from './index';
import { configureList } from './utils';
import { ApiSyntaxError } from './errors/apiSyntaxError';
import { ApiResponseError } from './errors/apiResponseError';
import { Diaspora, QueryLanguage, Entity } from '@diaspora/diaspora';

const QUERY_OPTS = ['skip', 'limit', 'sort', 'page'];

/**
 * Base class that generates a middleware, to interact with Diaspora models
 *
 * @author Gerkin
 */
export abstract class ApiGenerator<T> {

	/**
	 * Instance of the middleware to be used by the application
	 *
	 * @se {@link ApiGenerator.middleware}
	 * @author Gerkin
	 */
	protected readonly _middleware: T;
	/**
	 * Public getter to retrieve the middleware instance usable by application
	 *
	 * @se {@link ApiGenerator.middleware}
	 * @author Gerkin
	 */
	public get middleware() {
		return this._middleware;
	}

	/**
	 * Dictionary containing each configured models settings.
	 *
	 * @author Gerkin
	 */
	protected readonly _modelsConfiguration: _.Dictionary<IModelConfiguration<any>>;

	protected constructor( configHash: IConfigurationRaw, middleware: T ){
		// Get only models authorized
		const allModels = _.keys( Diaspora.models );
		const configuredModels = ( () => {
			try {
				return configureList( configHash.models, allModels ) || {};
			} catch ( error ) {
				if ( error instanceof ReferenceError ) {
					throw new ReferenceError(
						`Tried to configure Diaspora Server with unknown model. Original message: ${
							error.message
						}.${allModels.length === 0 ? '\nSee https://goo.gl/Auj3DB for more infos.' : ''}`
					);
				} else {
					throw error;
				}
			}
		} )();



		// Configure router
		this._modelsConfiguration = _.mapValues( configuredModels, ( apiDesc, modelName ) => {
			const defaultedApiDesc = apiDesc === true ? {} : apiDesc;

			const defaulted = _.defaults( defaultedApiDesc, {
				singular: modelName.toLowerCase(),
				plural: `${modelName.toLowerCase()}s`,
				middlewares: {},
			} );
			Diaspora.logger.verbose( `Exposing ${modelName} (endpoints "/${defaulted.singular}" & "/${defaulted.plural}")` );
			const model = Diaspora.models[modelName];
			const modelConfiguration = _.assign( defaulted, {model} ) as IModelConfiguration<any>;
			return modelConfiguration;
		} );
		this._middleware = middleware;
	}

	/**
	 * Parse a query string to separate options from search clause.
	 *
	 * @param queryObj - Query string to parse
	 * @returns A hash with options & search clause separated
	 * @author Gerkin
	 */
	public static parseQuery( queryObj: object ){
		const raw = _.mapValues( queryObj, ( val, key ) => {
			try{
				return JSON.parse( val );
			} catch ( error ){
				throw ApiResponseError.MalformedQuery( new ApiSyntaxError( 'Invalid syntax parsing query', error ) );
			}
		} );

		return {
			raw,
			options: _.pick( raw, QUERY_OPTS ) as QueryLanguage.IQueryOptions,
			where: _.get( raw, 'where', _.omit( raw, QUERY_OPTS ) ) as QueryLanguage.SelectQueryOrCondition,
		};
	}

	/**
	 * Adds the ID of the entity to the JSON to send to the client. This property is usually not stored in the entity's attributes hash, so we manually add it here.
	 *
	 * @param entity - Entity to cast to JSON with ID
	 * @returns The entity attributes, with the ID defined.
	 * @author Gerkin
	 */
	protected static setIdFromIdHash<TModel>( entity: Entity<TModel> ){
		const retVal = entity.getProperties( entity.model.getDataSource() );
		if ( retVal ) {
			delete retVal.idHash;
		}
		return retVal;
	}
}
