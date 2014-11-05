/*
 * Copyright © WebServices pour l'Éducation, 2014
 *
 * This file is part of ENT Core. ENT Core is a versatile ENT engine based on the JVM.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation (version 3 of the License).
 *
 * For the sake of explanation, any module that communicate over native
 * Web protocols, such as HTTP, with ENT Core is outside the scope of this
 * license and could be license under its own terms. This is merely considered
 * normal use of ENT Core, and does not fall under the heading of "covered work".
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

package org.entcore.cas;

import org.entcore.cas.controllers.CredentialController;
import org.entcore.cas.controllers.EntCoreCredentialResponse;
import org.entcore.cas.controllers.SamlValidatorController;
import org.entcore.cas.controllers.ValidatorController;
import org.entcore.cas.data.EntCoreDataHandlerFactory;
import org.entcore.cas.http.VertxHttpClientFactory;
import org.entcore.common.http.BaseServer;

import fr.wseduc.cas.data.DataHandlerFactory;
import fr.wseduc.cas.endpoint.CasValidator;
import fr.wseduc.cas.endpoint.Credential;
import fr.wseduc.cas.endpoint.SamlValidator;
import fr.wseduc.cas.http.HttpClientFactory;


public class Cas extends BaseServer {

	@Override
	public void start() {
		super.start();

		DataHandlerFactory dataHandlerFactory = new EntCoreDataHandlerFactory(getEventBus(vertx), config);
		HttpClientFactory httpClientFactory = new VertxHttpClientFactory(vertx);

		Credential credential = new Credential();
		credential.setDataHandlerFactory(dataHandlerFactory);
		credential.setCredentialResponse(new EntCoreCredentialResponse());
		CredentialController credentialController = new CredentialController();
		credentialController.setCredential(credential);
		addController(credentialController);

		CasValidator casValidator = new CasValidator();
		casValidator.setDataHandlerFactory(dataHandlerFactory);
		ValidatorController validatorController = new ValidatorController();
		validatorController.setValidator(casValidator);
		addController(validatorController);

		SamlValidator samlValidator = new SamlValidator();
		samlValidator.setDataHandlerFactory(dataHandlerFactory);
		SamlValidatorController samlvalidatorController = new SamlValidatorController();
		samlvalidatorController.setValidator(samlValidator);
		addController(samlvalidatorController);
	}

}
