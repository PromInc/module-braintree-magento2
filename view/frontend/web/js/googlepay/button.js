/**
 * Braintree Google Pay button
 * @author Aidan Threadgold <aidan@gene.co.uk>
 */
define(
    [
        'uiComponent',
        "knockout",
        "jquery",
        'braintree',
        'braintreeDataCollector',
        'braintreeGooglePay',
        'mage/translate',
        'googlePayLibrary'
    ],
    function (
        Component,
        ko,
        jQuery,
        braintree,
        dataCollector,
        googlePay,
        $t
    ) {
        'use strict';

        return {
            init: function (element, context) {
                // No element or context
                if (!element || !context || !this.deviceSupported()) {
                    return;
                }

                // Context must implement these methods
                if (typeof context.getClientToken !== 'function') {
                    console.error("Braintree GooglePay Context passed does not provide a getClientToken method", context);
                    return;
                }
                if (typeof context.getPaymentRequest !== 'function') {
                    console.error("Braintree GooglePay Context passed does not provide a getPaymentRequest method", context);
                    return;
                }
                if (typeof context.startPlaceOrder !== 'function') {
                    console.error("Braintree GooglePay Context passed does not provide a startPlaceOrder method", context);
                    return;
                }

                // init google pay object
                var paymentsClient = new google.payments.api.PaymentsClient({
                    environment: context.getEnvironment()
                });

                // Create a button within the KO element, as google pay can only be instantiated through
                // a valid on click event (ko onclick bind interferes with this).
                var deviceData;
                var button = document.createElement('button');
                button.className = "braintree-googlepay-button long " + (context.getBtnColor() == 1 ? 'black' : 'white');
                button.title = $t("Buy with Google Pay");

                // init braintree api
                braintree.create({
                    authorization: context.getClientToken()
                }, function (clientErr, clientInstance) {
                    if (clientErr) {
                        console.error('Error creating client:', clientErr);
                        return;
                    }
                    dataCollector.create({
                        client: clientInstance
                    }, function (dataCollectorErr, dataCollectorInstance) {
                        if (dataCollectorErr) {
                            return;
                        }

                        googlePay.create({
                            client: clientInstance,
                            googlePayVersion: 2
                        }, function (googlePayErr, googlePaymentInstance) {
                            // No instance
                            if (googlePayErr) {
                                console.error('Braintree GooglePay Error creating googlePayInstance:', googlePayErr);
                                return;
                            }
                            paymentsClient.isReadyToPay({
                                apiVersion: 2,
                                apiVersionMinor: 0,
                                allowedPaymentMethods: googlePaymentInstance.createPaymentDataRequest().allowedPaymentMethods
                            }).then(function(response) {
                                if (response.result) {
                                    button.addEventListener('click', function (event) {
                                        event.preventDefault();

                                        //default.js payment expects validation to be called before calling the place order chain, googlepay is not the only component in the site
                                        if(!context.validate() || !context.getAdditionalValidators().validate()) {
                                            return false;
                                        }

                                        jQuery("body").loader('show');
                                        var responseData;

                                        var paymentDataRequest = googlePaymentInstance.createPaymentDataRequest(context.getPaymentRequest());
                                        paymentsClient.loadPaymentData(paymentDataRequest).then(function (paymentData) {
                                            // Persist the paymentData (shipping address etc)
                                            responseData = paymentData;
                                            // Return the braintree nonce promise
                                            return googlePaymentInstance.parseResponse(paymentData);
                                        }).then(function (result) {
                                            context.startPlaceOrder(result.nonce, responseData, dataCollectorInstance.deviceData);
                                        }).catch(function (err) {
                                            // Handle errors
                                            // err = {statusCode: "CANCELED"}
                                            console.error(err);
                                            jQuery("body").loader('hide');
                                        });
                                    });

                                    element.appendChild(button);
                                }
                            }).catch(function (err) {
                                console.error(err);
                                jQuery("body").loader('hide');
                            });
                        });
                    });
                });
            },

            deviceSupported: function() {
                return !!(window.PaymentRequest);
            }
        };
    }
);
